import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import {
  validateBody,
  validateParams,
  validateQuery,
  paginatedResponse,
  errorResponse,
  successResponse,
  ApiError,
} from "@/lib/api-utils"
import { MediaIdParamSchema } from "@/lib/schemas"
import { CreateCommentSchema, ListCommentsQuerySchema } from "@/lib/schemas/comment"
import { validateShareToken } from "@/lib/tokens"

type RouteParams = { params: Promise<{ id: string }> }

async function getMediaForRead(request: NextRequest, mediaId: string) {
  const token = new URL(request.url).searchParams.get("token")
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      project: { select: { id: true, createdById: true } },
      event: { select: { id: true, createdById: true } },
    },
  })

  if (!media) {
    throw new ApiError(404, "Media not found", "NOT_FOUND")
  }

  if (token) {
    const shareToken = await validateShareToken(token, "VALIDATOR")
    if (!shareToken.projectId || shareToken.projectId !== media.projectId) {
      throw new ApiError(403, "Not authorized to access this media", "FORBIDDEN")
    }
    return media
  }

  const user = await requireAuth()
  if (media.projectId && media.project?.createdById !== user.id) {
    throw new ApiError(403, "Not authorized to access this media", "FORBIDDEN")
  }
  if (media.eventId && media.event?.createdById !== user.id) {
    throw new ApiError(403, "Not authorized to access this media", "FORBIDDEN")
  }

  return media
}

async function getMediaForWrite(mediaId: string, userId: string) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      project: { select: { id: true, createdById: true } },
      event: { select: { id: true, createdById: true } },
    },
  })

  if (!media) {
    throw new ApiError(404, "Media not found", "NOT_FOUND")
  }

  if (media.projectId && media.project?.createdById !== userId) {
    throw new ApiError(403, "Not authorized to comment on this media", "FORBIDDEN")
  }
  if (media.eventId && media.event?.createdById !== userId) {
    throw new ApiError(403, "Not authorized to comment on this media", "FORBIDDEN")
  }

  return media
}

async function getMediaForTokenWrite(mediaId: string, token: string) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      project: { select: { id: true } },
    },
  })

  if (!media) {
    throw new ApiError(404, "Media not found", "NOT_FOUND")
  }

  const shareToken = await validateShareToken(token, "VALIDATOR")
  if (!shareToken.projectId || shareToken.projectId !== media.projectId) {
    throw new ApiError(403, "Not authorized to comment on this media", "FORBIDDEN")
  }

  return { media, shareToken }
}

// GET /api/media/[id]/comments - List comments (supports token for project review)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = validateParams(await params, MediaIdParamSchema)
    await getMediaForRead(request, id)

    const query = validateQuery(request, ListCommentsQuerySchema)
    const { page, limit, parentId, type } = query

    const where = {
      mediaId: id,
      ...(parentId ? { parentId } : { parentId: null }),
      ...(type ? { type } : {}),
    }

    const [total, comments] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { name: true, image: true } },
          replies: parentId
            ? false
            : {
                orderBy: { createdAt: "asc" },
                include: { author: { select: { name: true, image: true } } },
              },
        },
      }),
    ])

    const data = comments.map((comment) => ({
      id: comment.id,
      type: comment.type,
      content: comment.content,
      timecode: comment.timecode,
      mediaId: comment.mediaId,
      authorId: comment.authorId,
      authorName: comment.authorName ?? comment.author?.name ?? null,
      authorImage: comment.authorImage ?? comment.author?.image ?? null,
      parentId: comment.parentId,
      replyCount: comment.replies ? comment.replies.length : undefined,
      replies: comment.replies
        ? comment.replies.map((reply) => ({
            id: reply.id,
            type: reply.type,
            content: reply.content,
            timecode: reply.timecode,
            mediaId: reply.mediaId,
            authorId: reply.authorId,
            authorName: reply.authorName ?? reply.author?.name ?? null,
            authorImage: reply.authorImage ?? reply.author?.image ?? null,
            parentId: reply.parentId,
            createdAt: reply.createdAt.toISOString(),
            updatedAt: reply.updatedAt.toISOString(),
          }))
        : undefined,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    }))

    return paginatedResponse(data, total, page, limit)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/media/[id]/comments - Create comment (auth required)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = validateParams(await params, MediaIdParamSchema)
    const body = await validateBody(request, CreateCommentSchema)
    const token = new URL(request.url).searchParams.get("token")
    let authorId: string | null = null
    let authorName: string | null = null

    if (token) {
      const { shareToken } = await getMediaForTokenWrite(id, token)
      authorName = shareToken.label || "Validator"
    } else {
      const user = await requireAuth()
      await getMediaForWrite(id, user.id)
      authorId = user.id
    }

    if (body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: body.parentId } })
      if (!parent || parent.mediaId !== id) {
        throw new ApiError(400, "Invalid parent comment", "INVALID_PARENT")
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        type: body.type,
        timecode: body.timecode ?? null,
        parentId: body.parentId,
        mediaId: id,
        authorId,
        authorName,
      },
      include: {
        author: { select: { name: true, image: true } },
      },
    })

    return successResponse(
      {
        id: comment.id,
        type: comment.type,
        content: comment.content,
        timecode: comment.timecode,
        mediaId: comment.mediaId,
        authorId: comment.authorId,
        authorName: comment.authorName ?? comment.author?.name ?? null,
        authorImage: comment.authorImage ?? comment.author?.image ?? null,
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
      201
    )
  } catch (error) {
    return errorResponse(error)
  }
}
