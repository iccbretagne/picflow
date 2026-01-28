import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateParams, successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { validateShareToken } from "@/lib/tokens"
import { getSignedDownloadUrl } from "@/lib/s3"
import { z } from "zod"

const ParamsSchema = z.object({
  token: z.string().length(64),
  id: z.string().cuid2(),
})

type RouteParams = { params: Promise<{ token: string; id: string }> }

// GET /api/download/[token]/photo/[id] - Download a photo
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token, id } = validateParams(await params, ParamsSchema)

    const shareToken = await validateShareToken(token)

    if (shareToken.eventId) {
      const media = await prisma.media.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      })

      if (!media || media.eventId !== shareToken.eventId || media.type !== "PHOTO") {
        throw new ApiError(404, "Photo not found", "NOT_FOUND")
      }

      if (shareToken.type === "MEDIA" && media.status !== "APPROVED") {
        throw new ApiError(403, "Photo not validated", "NOT_APPROVED")
      }

      const latest = media.versions[0]
      if (!latest) {
        throw new ApiError(404, "Photo version not found", "NOT_FOUND")
      }

      const url = await getSignedDownloadUrl(latest.originalKey, media.filename)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      return successResponse({
        url,
        expiresAt: expiresAt.toISOString(),
        filename: media.filename,
      })
    }

    if (!shareToken.projectId) {
      throw new ApiError(400, "This token is not associated with a project", "INVALID_TOKEN_TYPE")
    }

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    })

    if (!media || media.projectId !== shareToken.projectId) {
      throw new ApiError(404, "Media not found", "NOT_FOUND")
    }

    if (shareToken.type === "MEDIA" && !(media.status === "APPROVED" || media.status === "FINAL_APPROVED")) {
      throw new ApiError(403, "Media not validated", "NOT_APPROVED")
    }

    const latestVersion = media.versions[0]
    if (!latestVersion) {
      throw new ApiError(404, "Media version not found", "NOT_FOUND")
    }

    const url = await getSignedDownloadUrl(latestVersion.originalKey, media.filename)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    return successResponse({
      url,
      expiresAt: expiresAt.toISOString(),
      filename: media.filename,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
