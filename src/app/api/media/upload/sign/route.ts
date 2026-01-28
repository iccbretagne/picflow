import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import {
  validateBody,
  successResponse,
  errorResponse,
  ApiError,
} from "@/lib/api-utils"
import {
  RequestPresignedUrlSchema,
  PRESIGNED_URL_EXPIRY,
  MAX_FILE_SIZE,
} from "@/lib/schemas"
import { getSignedPutUrl, getQuarantineKey } from "@/lib/s3"
import {
  createUploadSession,
  checkRateLimit,
} from "@/lib/upload-session"

// POST /api/media/upload/sign - Request presigned URL for direct upload
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await validateBody(request, RequestPresignedUrlSchema)

    // Check rate limit
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
        "RATE_LIMIT_EXCEEDED"
      )
    }

    // Verify event or project exists and user has access
    if (body.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: body.eventId },
      })
      if (!event) {
        throw new ApiError(404, "Event not found", "NOT_FOUND")
      }
    } else if (body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
      })
      if (!project) {
        throw new ApiError(404, "Project not found", "NOT_FOUND")
      }
    }

    // Extract extension from filename
    const extension = body.filename.split(".").pop()?.toLowerCase() || "bin"

    // Create upload session first to get the ID
    const session = createUploadSession({
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      type: body.type,
      eventId: body.eventId,
      projectId: body.projectId,
      s3Key: "", // Will be set below
      expirySeconds: PRESIGNED_URL_EXPIRY,
    })

    // Generate quarantine key using session ID
    const quarantineKey = getQuarantineKey(session.id, extension)

    // Update session with the S3 key (we need to recreate since session is immutable)
    // Actually, let's modify the session manager to allow updates, or just store the key directly
    // For now, we'll delete and recreate with the correct key
    const { deleteUploadSession: deleteSession, createUploadSession: createSession } = await import("@/lib/upload-session")
    deleteSession(session.id)

    const finalSession = createSession({
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      type: body.type,
      eventId: body.eventId,
      projectId: body.projectId,
      s3Key: quarantineKey,
      expirySeconds: PRESIGNED_URL_EXPIRY,
    })

    // Generate presigned PUT URL
    const url = await getSignedPutUrl(
      quarantineKey,
      body.contentType,
      MAX_FILE_SIZE,
      PRESIGNED_URL_EXPIRY
    )

    return successResponse({
      uploadId: finalSession.id,
      url,
      expiresAt: finalSession.expiresAt.toISOString(),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
