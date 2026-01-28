import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateParams, successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { validateShareToken } from "@/lib/tokens"
import { getSignedOriginalUrl } from "@/lib/s3"
import { z } from "zod"

const ParamsSchema = z.object({
  token: z.string().length(64),
  id: z.string().cuid2(),
})

type RouteParams = { params: Promise<{ token: string; id: string }> }

// GET /api/validate/[token]/photo/[id] - Get HD photo URL
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token, id } = validateParams(await params, ParamsSchema)

    const shareToken = await validateShareToken(token, "VALIDATOR")

    // Find photo and verify it belongs to this event
    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    })

    if (!media || media.eventId !== shareToken.eventId || media.type !== "PHOTO") {
      throw new ApiError(404, "Photo not found", "NOT_FOUND")
    }

    const latest = media.versions[0]
    if (!latest) {
      throw new ApiError(404, "Photo version not found", "NOT_FOUND")
    }

    const url = await getSignedOriginalUrl(latest.originalKey)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    return successResponse({
      url,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
