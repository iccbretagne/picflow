import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateParams, successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { TokenParamSchema } from "@/lib/schemas"
import { validateShareToken } from "@/lib/tokens"
import { getSignedThumbnailUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ token: string }> }

type DownloadItem = {
  id: string
  filename: string
  thumbnailUrl: string
  status: string
  width: number | null
  height: number | null
  uploadedAt: string
  validatedAt: string | null
}

function isDownloadItem(item: DownloadItem | null): item is DownloadItem {
  return item !== null
}

// GET /api/download/[token] - List downloadable photos (validated only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)

    // Accept both VALIDATOR and MEDIA tokens for download
    const shareToken = await validateShareToken(token)
    const event = shareToken.event

    if (event) {
      // Filter only approved photos
      const approvedPhotos = event.photos.filter(
        (p: { status: "PENDING" | "APPROVED" | "REJECTED" }) =>
          p.status === "APPROVED"
      )

      // Generate signed URLs
      const photosWithUrls = await Promise.all(
        approvedPhotos.map(async (photo) => ({
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

      return successResponse({
        event: {
          id: event.id,
          name: event.name,
          date: event.date.toISOString(),
          church: event.church.name,
        },
        photos: photosWithUrls,
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

    const approvedMedia = project.media.filter(
      (m) => m.status === "APPROVED" || m.status === "FINAL_APPROVED"
    )

    const mediaWithUrls = await Promise.all(
      approvedMedia.map(async (media) => {
        const latestVersion = media.versions[0]
        if (!latestVersion) return null

        return {
          id: media.id,
          filename: media.filename,
          thumbnailUrl: await getSignedThumbnailUrl(latestVersion.thumbnailKey),
          status: media.status,
          width: media.width,
          height: media.height,
          uploadedAt: media.createdAt.toISOString(),
          validatedAt: null,
        }
      })
    )

    const photos = mediaWithUrls.filter(isDownloadItem)

    return successResponse({
      event: {
        id: project.id,
        name: project.name,
        date: project.createdAt.toISOString(),
        church: project.church.name,
      },
      photos,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
