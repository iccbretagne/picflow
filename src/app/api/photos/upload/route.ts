import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { uploadFile, getMediaOriginalKey, getMediaThumbnailKey, getSignedThumbnailUrl } from "@/lib/s3"
import { processImage, validateFile, getExtensionFromMimeType } from "@/lib/sharp"
import { createId } from "@paralleldrive/cuid2"

// POST /api/photos/upload - Upload photos
// All authenticated users can upload to any event
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const formData = await request.formData()
    const eventId = formData.get("eventId") as string
    const files = formData.getAll("files") as File[]

    if (!eventId) {
      throw new ApiError(400, "eventId is required", "MISSING_PARAM")
    }

    if (!files || files.length === 0) {
      throw new ApiError(400, "No files provided", "MISSING_FILES")
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND")
    }

    const uploaded: { id: string; filename: string; thumbnailUrl: string }[] = []
    const errors: { filename: string; error: string }[] = []

    for (const file of files) {
      try {
        // Validate file
        validateFile(file.name, file.type, file.size)

        // Read file buffer
        const buffer = Buffer.from(await file.arrayBuffer())

        // Process image
        const processed = await processImage(buffer)

        const mediaId = createId()

        // Generate S3 keys (media photo)
        const extension = getExtensionFromMimeType(file.type)
        const originalKey = getMediaOriginalKey("events", eventId, mediaId, extension)
        const thumbnailKey = getMediaThumbnailKey("events", eventId, mediaId)

        await prisma.$transaction(async (tx) => {
          await tx.media.create({
            data: {
              id: mediaId,
              type: "PHOTO",
              status: "PENDING",
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              width: processed.metadata.width,
              height: processed.metadata.height,
              eventId,
            },
          })

          await tx.mediaVersion.create({
            data: {
              mediaId,
              versionNumber: 1,
              originalKey,
              thumbnailKey,
              createdById: user.id,
            },
          })
        })

        // Upload to S3
        await Promise.all([
          uploadFile(originalKey, processed.original, "image/jpeg"),
          uploadFile(thumbnailKey, processed.thumbnail, "image/webp"),
        ])

        // Get signed thumbnail URL
        const thumbnailUrl = await getSignedThumbnailUrl(thumbnailKey)

        uploaded.push({
          id: mediaId,
          filename: file.name,
          thumbnailUrl,
        })
      } catch (error) {
        errors.push({
          filename: file.name,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    // Update event status if this is the first upload
    if (uploaded.length > 0 && event.status === "DRAFT") {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: "PENDING_REVIEW" },
      })
    }

    return successResponse({ uploaded, errors })
  } catch (error) {
    return errorResponse(error)
  }
}
