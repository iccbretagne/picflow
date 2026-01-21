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
import { CreateShareTokenSchema, IdParamSchema } from "@/lib/schemas"
import { createShareToken } from "@/lib/tokens"

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/events/[id]/share - Create share token
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = validateParams(await params, IdParamSchema)
    const body = await validateBody(request, CreateShareTokenSchema)

    // Check event exists and belongs to user
    const event = await prisma.event.findUnique({
      where: { id, createdById: user.id },
    })

    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND")
    }

    const token = await createShareToken(
      id,
      body.type,
      body.label,
      body.expiresInDays
    )

    return successResponse(
      {
        id: token.id,
        token: token.token,
        url: token.url,
        type: token.type,
        label: token.label,
        expiresAt: token.expiresAt?.toISOString() || null,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: token.createdAt.toISOString(),
      },
      201
    )
  } catch (error) {
    return errorResponse(error)
  }
}

// GET /api/events/[id]/share - List share tokens
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = validateParams(await params, IdParamSchema)

    // Check event exists and belongs to user
    const event = await prisma.event.findUnique({
      where: { id, createdById: user.id },
    })

    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND")
    }

    const tokens = await prisma.shareToken.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    })

    const baseUrl = process.env.APP_URL || "http://localhost:3000"

    return successResponse(
      tokens.map((t) => ({
        id: t.id,
        token: t.token,
        url: `${baseUrl}/${t.type === "VALIDATOR" ? "v" : "d"}/${t.token}`,
        type: t.type,
        label: t.label,
        expiresAt: t.expiresAt?.toISOString() || null,
        lastUsedAt: t.lastUsedAt?.toISOString() || null,
        usageCount: t.usageCount,
        createdAt: t.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/events/[id]/share - Delete a share token
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = validateParams(await params, IdParamSchema)
    const url = new URL(request.url)
    const tokenId = url.searchParams.get("tokenId")

    if (!tokenId) {
      throw new ApiError(400, "tokenId query parameter required", "MISSING_PARAM")
    }

    // Check event exists and belongs to user
    const event = await prisma.event.findUnique({
      where: { id, createdById: user.id },
    })

    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND")
    }

    await prisma.shareToken.delete({
      where: { id: tokenId, eventId: id },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
