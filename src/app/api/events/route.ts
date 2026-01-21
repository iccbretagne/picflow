import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import {
  validateBody,
  validateQuery,
  successResponse,
  paginatedResponse,
  errorResponse,
  getPaginationParams,
} from "@/lib/api-utils"
import { CreateEventSchema, ListEventsQuerySchema } from "@/lib/schemas"

// GET /api/events - List events
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const query = validateQuery(request, ListEventsQuerySchema)

    const { skip, take } = getPaginationParams(query.page, query.limit)

    const where = {
      createdById: user.id,
      ...(query.status && { status: query.status }),
      ...(query.church && { church: query.church }),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { date: "desc" },
        include: {
          _count: {
            select: { photos: true },
          },
          photos: {
            select: { status: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ])

    // Transform to include stats
    const eventsWithStats = events.map((event) => {
      const approvedCount = event.photos.filter((p) => p.status === "APPROVED").length
      const rejectedCount = event.photos.filter((p) => p.status === "REJECTED").length
      const pendingCount = event.photos.filter((p) => p.status === "PENDING").length

      return {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        church: event.church,
        description: event.description,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        photoCount: event._count.photos,
        approvedCount,
        rejectedCount,
        pendingCount,
      }
    })

    return paginatedResponse(eventsWithStats, total, query.page, query.limit)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/events - Create event
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await validateBody(request, CreateEventSchema)

    const event = await prisma.event.create({
      data: {
        name: body.name,
        date: new Date(body.date),
        church: body.church,
        description: body.description,
        createdById: user.id,
      },
    })

    return successResponse(
      {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        church: event.church,
        description: event.description,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      },
      201
    )
  } catch (error) {
    return errorResponse(error)
  }
}
