import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateParams, successResponse, errorResponse } from "@/lib/api-utils"
import { TokenParamSchema } from "@/lib/schemas"
import { validateShareToken } from "@/lib/tokens"
import { getSignedThumbnailUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ token: string }> }

// GET /api/download/[token] - List downloadable photos (validated only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)

    // Accept both VALIDATOR and MEDIA tokens for download
    const shareToken = await validateShareToken(token)
    const event = shareToken.event

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
  } catch (error) {
    return errorResponse(error)
  }
}
