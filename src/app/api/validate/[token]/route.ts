import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  validateBody,
  validateParams,
  successResponse,
  errorResponse,
  ApiError,
} from "@/lib/api-utils"
import { SubmitValidationSchema, TokenParamSchema } from "@/lib/schemas"
import { validateShareToken } from "@/lib/tokens"
import { getSignedThumbnailUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ token: string }> }

// GET /api/validate/[token] - Get event for validation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)
    const shareToken = await validateShareToken(token, "VALIDATOR")

    const event = shareToken.event
    const photos = event.photos

    // Generate signed URLs for thumbnails
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        filename: photo.filename,
        thumbnailUrl: await getSignedThumbnailUrl(photo.thumbnailKey),
        status: photo.status,
        width: photo.width,
        height: photo.height,
        uploadedAt: photo.uploadedAt.toISOString(),
        validatedAt: photo.validatedAt?.toISOString() || null,
      }))
    )

    const stats = {
      total: photos.length,
      pending: photos.filter((p) => p.status === "PENDING").length,
      approved: photos.filter((p) => p.status === "APPROVED").length,
      rejected: photos.filter((p) => p.status === "REJECTED").length,
    }

    return successResponse({
      event: {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        church: event.church.name,
      },
      photos: photosWithUrls,
      stats,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

// PATCH /api/validate/[token] - Submit validation decisions
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)
    const shareToken = await validateShareToken(token, "VALIDATOR")
    const body = await validateBody(request, SubmitValidationSchema)

    const eventId = shareToken.eventId
    const validatorLabel = shareToken.label || "Validator"

    // Validate all photoIds belong to this event
    const photoIds = body.decisions.map((d) => d.photoId)
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        eventId,
      },
    })

    if (photos.length !== photoIds.length) {
      throw new ApiError(400, "Some photos do not belong to this event", "INVALID_PHOTOS")
    }

    // Update photos
    const updates = body.decisions.map((decision) =>
      prisma.photo.update({
        where: { id: decision.photoId },
        data: {
          status: decision.status,
          validatedAt: new Date(),
          validatedBy: validatorLabel,
        },
      })
    )

    await prisma.$transaction(updates)

    // Get updated stats
    const allPhotos = await prisma.photo.findMany({
      where: { eventId },
      select: { status: true },
    })

    const stats = {
      total: allPhotos.length,
      approved: allPhotos.filter((p) => p.status === "APPROVED").length,
      rejected: allPhotos.filter((p) => p.status === "REJECTED").length,
    }

    // Update event status if all photos are reviewed
    const pendingCount = allPhotos.filter((p) => p.status === "PENDING").length
    if (pendingCount === 0) {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: "REVIEWED" },
      })
    }

    return successResponse({
      updated: body.decisions.length,
      stats,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
