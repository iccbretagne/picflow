import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import {
  validateQuery,
  successResponse,
  errorResponse,
} from "@/lib/api-utils"
import { ListUsersQuerySchema } from "@/lib/schemas"

// GET /api/users - Liste tous les utilisateurs (users:view permission)
export async function GET(request: NextRequest) {
  try {
    await requirePermission("users:view")

    const query = validateQuery(request, ListUsersQuerySchema)

    const where = {
      ...(query.status && { status: query.status }),
      ...(query.role && { role: query.role }),
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    const usersResponse = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      _count: user._count,
    }))

    return successResponse(usersResponse)
  } catch (error) {
    return errorResponse(error)
  }
}
