import { NextRequest } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import {
  validateBody,
  successResponse,
  errorResponse,
  ApiError,
} from "@/lib/api-utils"
import { ConfirmUploadSchema } from "@/lib/schemas"
import {
  fileExists,
  getFileHead,
  getFileBytes,
  moveFile,
  uploadFile,
  getMediaOriginalKey,
  getMediaThumbnailKey,
  getSignedThumbnailUrl,
  deleteFile,
} from "@/lib/s3"
import { getUploadSession, deleteUploadSession } from "@/lib/upload-session"
import { validateMagicBytes } from "@/lib/magic-bytes"
import { generateThumbnail } from "@/lib/sharp"

// Generate a cuid-like ID
function generateMediaId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(8).toString("base64url")
  return `c${timestamp}${random}`.slice(0, 25)
}

// POST /api/media/upload/confirm - Confirm upload and create media record
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await validateBody(request, ConfirmUploadSchema)

    // Get upload session
    const session = getUploadSession(body.uploadId)
    if (!session) {
      throw new ApiError(404, "Upload session not found or expired", "SESSION_NOT_FOUND")
    }

    // Verify session belongs to user
    if (session.userId !== user.id) {
      throw new ApiError(403, "Not authorized to confirm this upload", "FORBIDDEN")
    }

    // Check file exists in S3
    const exists = await fileExists(session.s3Key)
    if (!exists) {
      throw new ApiError(400, "File not uploaded to S3", "FILE_NOT_FOUND")
    }

    // Verify file size
    const fileHead = await getFileHead(session.s3Key)
    if (!fileHead) {
      throw new ApiError(500, "Could not read file metadata", "READ_ERROR")
    }

    if (fileHead.size !== session.size) {
      await deleteFile(session.s3Key)
      deleteUploadSession(body.uploadId)
      throw new ApiError(400, "File size mismatch", "SIZE_MISMATCH")
    }

    // Validate magic bytes (first up to 512 bytes)
    if (session.size === 0) {
      await deleteFile(session.s3Key)
      deleteUploadSession(body.uploadId)
      throw new ApiError(400, "File is empty", "EMPTY_FILE")
    }

    const headerEnd = Math.min(511, session.size - 1)
    const headerBytes = await getFileBytes(session.s3Key, 0, headerEnd)
    if (!headerBytes) {
      throw new ApiError(500, "Could not read file header", "READ_ERROR")
    }

    const validation = validateMagicBytes(new Uint8Array(headerBytes), session.contentType)
    if (!validation.valid) {
      await deleteFile(session.s3Key)
      deleteUploadSession(body.uploadId)
      throw new ApiError(
        400,
        `File type mismatch. Expected ${session.contentType}, detected ${validation.detectedType || "unknown"}`,
        "TYPE_MISMATCH"
      )
    }

    // Generate media ID
    const mediaId = generateMediaId()

    // Determine container type and ID
    const containerType = session.eventId ? "events" : "projects"
    const containerId = session.eventId || session.projectId!

    // Extract extension from filename
    const extension = session.filename.split(".").pop()?.toLowerCase() || "bin"

    // Generate final keys
    const originalKey = getMediaOriginalKey(containerType, containerId, mediaId, extension)
    const thumbnailKey = getMediaThumbnailKey(containerType, containerId, mediaId)

    // Process thumbnail before moving (so we can read from quarantine)
    let thumbnailBuffer: Buffer

    if (session.type === "VIDEO") {
      // For videos, use the thumbnail provided by the client
      if (!body.thumbnailDataUrl) {
        throw new ApiError(400, "Thumbnail required for video uploads", "THUMBNAIL_REQUIRED")
      }

      // Parse data URL
      const matches = body.thumbnailDataUrl.match(/^data:image\/\w+;base64,(.+)$/)
      if (!matches) {
        throw new ApiError(400, "Invalid thumbnail data URL format", "INVALID_THUMBNAIL")
      }

      const base64Data = matches[1]
      const imageBuffer = Buffer.from(base64Data, "base64")
      thumbnailBuffer = await generateThumbnail(imageBuffer)
    } else {
      // For images/visuals, generate thumbnail server-side
      const originalFileBytes = await getFileBytes(session.s3Key, 0, session.size - 1)
      if (!originalFileBytes) {
        throw new ApiError(500, "Could not read uploaded file for thumbnail generation", "READ_ERROR")
      }

      if (session.contentType === "application/pdf") {
        thumbnailBuffer = await generatePlaceholderThumbnail("PDF")
      } else if (session.contentType === "image/svg+xml") {
        thumbnailBuffer = await generatePlaceholderThumbnail("SVG")
      } else {
        thumbnailBuffer = await generateThumbnail(originalFileBytes)
      }
    }

    // Move file from quarantine to final location
    await moveFile(session.s3Key, originalKey)

    // Upload thumbnail
    await uploadFile(thumbnailKey, thumbnailBuffer, "image/webp")

    // Create media record in database
    const media = await prisma.media.create({
      data: {
        id: mediaId,
        type: session.type,
        status: "DRAFT",
        filename: session.filename,
        mimeType: session.contentType,
        size: session.size,
        ...(session.eventId && { eventId: session.eventId }),
        ...(session.projectId && { projectId: session.projectId }),
      },
    })

    // Create initial version record
    await prisma.mediaVersion.create({
      data: {
        mediaId: media.id,
        versionNumber: 1,
        originalKey,
        thumbnailKey,
        createdById: user.id,
      },
    })

    // Delete upload session
    deleteUploadSession(body.uploadId)

    // Get signed thumbnail URL
    const thumbnailUrl = await getSignedThumbnailUrl(thumbnailKey)

    return successResponse({
      id: media.id,
      type: media.type,
      filename: media.filename,
      thumbnailUrl,
    }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

// Helper function to generate placeholder thumbnail
async function generatePlaceholderThumbnail(type: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default

  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="48" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">${type}</text>
    </svg>
  `

  return sharp(Buffer.from(svg))
    .resize(400, 300, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer()
}
