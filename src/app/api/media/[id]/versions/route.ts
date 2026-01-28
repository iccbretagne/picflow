import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import {
  validateBody,
  validateParams,
  successResponse,
  errorResponse,
  ApiError,
} from "@/lib/api-utils"
import {
  MediaIdParamSchema,
  PRESIGNED_URL_EXPIRY,
  MAX_FILE_SIZE,
  VISUAL_MIME_TYPES,
  VIDEO_MIME_TYPES,
} from "@/lib/schemas"
import { ConfirmVersionUploadSchema, RequestVersionUploadSchema } from "@/lib/schemas/version"
import { createUploadSession, checkRateLimit, deleteUploadSession, getUploadSession } from "@/lib/upload-session"
import { getSignedPutUrl, getQuarantineKey, getVersionOriginalKey, getVersionThumbnailKey, uploadFile, getSignedThumbnailUrl, getSignedOriginalUrl, fileExists, getFileHead, getFileBytes, deleteFile, moveFile } from "@/lib/s3"
import { validateMagicBytes } from "@/lib/magic-bytes"
import { generateThumbnail } from "@/lib/sharp"

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/media/[id]/versions - Upload a new version (presigned URL flow)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = validateParams(await params, MediaIdParamSchema)
    const body = await validateBody(request, RequestVersionUploadSchema)

    // Ensure this upload targets the same media container
    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        project: { select: { createdById: true } },
        event: { select: { createdById: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    })

    if (!media) {
      throw new ApiError(404, "Media not found", "NOT_FOUND")
    }

    if (media.projectId && media.project?.createdById !== user.id) {
      throw new ApiError(403, "Not authorized to update this media", "FORBIDDEN")
    }
    if (media.eventId && media.event?.createdById !== user.id) {
      throw new ApiError(403, "Not authorized to update this media", "FORBIDDEN")
    }

    if (media.type === "PHOTO") {
      throw new ApiError(400, "Photo versions are not supported", "UNSUPPORTED_TYPE")
    }

    if (body.size > MAX_FILE_SIZE) {
      throw new ApiError(400, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, "FILE_TOO_LARGE")
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
        "RATE_LIMIT_EXCEEDED"
      )
    }

    const extension = body.filename.split(".").pop()?.toLowerCase() || "bin"

    // Validate content type matches media type
    if (media.type === "VISUAL" && !VISUAL_MIME_TYPES.includes(body.contentType as typeof VISUAL_MIME_TYPES[number])) {
      throw new ApiError(400, "Unsupported file type for visual media", "UNSUPPORTED_TYPE")
    }
    if (media.type === "VIDEO" && !VIDEO_MIME_TYPES.includes(body.contentType as typeof VIDEO_MIME_TYPES[number])) {
      throw new ApiError(400, "Unsupported file type for video media", "UNSUPPORTED_TYPE")
    }

    const session = createUploadSession({
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      type: media.type,
      eventId: media.eventId ?? undefined,
      projectId: media.projectId ?? undefined,
      s3Key: "",
      expirySeconds: PRESIGNED_URL_EXPIRY,
    })

    const quarantineKey = getQuarantineKey(session.id, extension)
    deleteUploadSession(session.id)
    const finalSession = createUploadSession({
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      type: media.type,
      eventId: media.eventId ?? undefined,
      projectId: media.projectId ?? undefined,
      s3Key: quarantineKey,
      expirySeconds: PRESIGNED_URL_EXPIRY,
    })

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

// PATCH /api/media/[id]/versions - Confirm upload and create MediaVersion
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = validateParams(await params, MediaIdParamSchema)
    const body = await validateBody(request, ConfirmVersionUploadSchema)

    const uploadId = body.uploadId
    const thumbnailDataUrl = body.thumbnailDataUrl
    if (!uploadId) {
      throw new ApiError(400, "uploadId is required", "MISSING_PARAM")
    }

    const session = getUploadSession(uploadId)
    if (!session) {
      throw new ApiError(404, "Upload session not found or expired", "SESSION_NOT_FOUND")
    }

    if (session.userId !== user.id) {
      throw new ApiError(403, "Not authorized to confirm this upload", "FORBIDDEN")
    }

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    })

    if (!media) {
      throw new ApiError(404, "Media not found", "NOT_FOUND")
    }

    if (media.type !== session.type) {
      throw new ApiError(400, "Media type mismatch", "TYPE_MISMATCH")
    }

    const exists = await fileExists(session.s3Key)
    if (!exists) {
      throw new ApiError(400, "File not uploaded to S3", "FILE_NOT_FOUND")
    }

    const fileHead = await getFileHead(session.s3Key)
    if (!fileHead) {
      throw new ApiError(500, "Could not read file metadata", "READ_ERROR")
    }

    if (fileHead.size !== session.size) {
      await deleteFile(session.s3Key)
      deleteUploadSession(uploadId)
      throw new ApiError(400, "File size mismatch", "SIZE_MISMATCH")
    }

    const headerEnd = Math.min(511, session.size - 1)
    const headerBytes = await getFileBytes(session.s3Key, 0, headerEnd)
    if (!headerBytes) {
      throw new ApiError(500, "Could not read file header", "READ_ERROR")
    }

    const validation = validateMagicBytes(new Uint8Array(headerBytes), session.contentType)
    if (!validation.valid) {
      await deleteFile(session.s3Key)
      deleteUploadSession(uploadId)
      throw new ApiError(
        400,
        `File type mismatch. Expected ${session.contentType}, detected ${validation.detectedType || "unknown"}`,
        "TYPE_MISMATCH"
      )
    }

    const nextVersion = (media.versions[0]?.versionNumber ?? 0) + 1
    const extension = session.filename.split(".").pop()?.toLowerCase() || "bin"
    const originalKey = getVersionOriginalKey(media.id, nextVersion, extension)
    const thumbnailKey = getVersionThumbnailKey(media.id, nextVersion)

    let thumbnailBuffer: Buffer
    let originalFileBytes: Buffer | null = null
    if (media.type === "VIDEO") {
      if (!thumbnailDataUrl) {
        throw new ApiError(400, "Thumbnail required for video uploads", "THUMBNAIL_REQUIRED")
      }
      const matches = thumbnailDataUrl.match(/^data:image\/\w+;base64,(.+)$/)
      if (!matches) {
        throw new ApiError(400, "Invalid thumbnail data URL format", "INVALID_THUMBNAIL")
      }
      const base64Data = matches[1]
      const imageBuffer = Buffer.from(base64Data, "base64")
      thumbnailBuffer = await generateThumbnail(imageBuffer)
    } else {
      originalFileBytes = await getFileBytes(session.s3Key, 0, session.size - 1)
      if (!originalFileBytes) {
        throw new ApiError(500, "Could not read uploaded file for thumbnail generation", "READ_ERROR")
      }
      thumbnailBuffer = await generateThumbnail(originalFileBytes)
    }

    // Move file from quarantine to versioned location
    await moveFile(session.s3Key, originalKey)
    await uploadFile(thumbnailKey, thumbnailBuffer, "image/webp")

    const version = await prisma.mediaVersion.create({
      data: {
        mediaId: media.id,
        versionNumber: nextVersion,
        originalKey,
        thumbnailKey,
        notes: body.notes ?? null,
        createdById: user.id,
      },
    })

    await prisma.media.update({
      where: { id: media.id },
      data: { status: "IN_REVIEW" },
    })

    deleteUploadSession(uploadId)

    const thumbnailUrl = await getSignedThumbnailUrl(thumbnailKey)
    const originalUrl = await getSignedOriginalUrl(originalKey)

    return successResponse({
      id: version.id,
      versionNumber: version.versionNumber,
      thumbnailUrl,
      originalUrl,
    }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
