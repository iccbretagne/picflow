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
import { getSignedThumbnailUrl, getSignedOriginalUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ token: string }> }

function normalizeMediaStatus(status: string): "PENDING" | "APPROVED" | "REJECTED" {
  if (status === "APPROVED" || status === "FINAL_APPROVED") return "APPROVED"
  if (status === "REJECTED") return "REJECTED"
  return "PENDING"
}

type ValidationItem = {
  id: string
  type: "PHOTO" | "VISUAL" | "VIDEO"
  filename: string
  thumbnailUrl: string
  originalUrl?: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  width: number | null
  height: number | null
  uploadedAt: string
  validatedAt: string | null
}

function isValidationItem(item: ValidationItem | null): item is ValidationItem {
  return item !== null
}

// GET /api/validate/[token] - Get event for validation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)
    const shareToken = await validateShareToken(token, "VALIDATOR")

    const event = shareToken.event

    if (event) {
      const photos = event.photos

      // Generate signed URLs for thumbnails
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => ({
        id: photo.id,
        type: "PHOTO",
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
    }

    if (!shareToken.projectId) {
      throw new ApiError(400, "This token is not associated with a project", "INVALID_TOKEN_TYPE")
    }

    const project = await prisma.project.findUnique({
      where: { id: shareToken.projectId },
      include: {
        church: { select: { name: true } },
        media: {
          orderBy: { createdAt: "desc" },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    if (!project) {
      throw new ApiError(404, "Project not found", "NOT_FOUND")
    }

    const mediaWithUrls = await Promise.all(
      project.media.map(async (media) => {
        const latestVersion = media.versions[0]
        if (!latestVersion) {
          return null
        }

        return {
          id: media.id,
          type: media.type,
          filename: media.filename,
          thumbnailUrl: await getSignedThumbnailUrl(latestVersion.thumbnailKey),
          originalUrl:
            media.type === "VIDEO"
              ? await getSignedOriginalUrl(latestVersion.originalKey)
              : undefined,
          status: normalizeMediaStatus(media.status),
          width: media.width,
          height: media.height,
          uploadedAt: media.createdAt.toISOString(),
          validatedAt: null,
        }
      })
    )

    const photos = mediaWithUrls.filter(isValidationItem)
    const stats = {
      total: photos.length,
      pending: photos.filter((p) => p.status === "PENDING").length,
      approved: photos.filter((p) => p.status === "APPROVED").length,
      rejected: photos.filter((p) => p.status === "REJECTED").length,
    }

    return successResponse({
      event: {
        id: project.id,
        name: project.name,
        date: project.createdAt.toISOString(),
        church: project.church.name,
      },
      photos,
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

    if (eventId) {
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
    }

    if (!shareToken.projectId) {
      throw new ApiError(400, "This token is not associated with a project", "INVALID_TOKEN_TYPE")
    }

    const mediaIds = body.decisions.map((d) => d.photoId)
    const media = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        projectId: shareToken.projectId,
      },
      select: { id: true },
    })

    if (media.length !== mediaIds.length) {
      throw new ApiError(400, "Some media do not belong to this project", "INVALID_MEDIA")
    }

    const updates = body.decisions.map((decision) =>
      prisma.media.update({
        where: { id: decision.photoId },
        data: {
          status: decision.status,
        },
      })
    )

    await prisma.$transaction(updates)

    const allMedia = await prisma.media.findMany({
      where: { projectId: shareToken.projectId },
      select: { status: true },
    })

    const stats = {
      total: allMedia.length,
      approved: allMedia.filter((m) => m.status === "APPROVED" || m.status === "FINAL_APPROVED").length,
      rejected: allMedia.filter((m) => m.status === "REJECTED").length,
    }

    return successResponse({
      updated: body.decisions.length,
      stats,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
