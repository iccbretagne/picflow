import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import {
  validateParams,
  successResponse,
  errorResponse,
  ApiError,
} from "@/lib/api-utils"
import { IdParamSchema, UpdateUserSchema } from "@/lib/schemas"

type RouteParams = {
  params: Promise<{ id: string }>
}

// PATCH /api/users/[id] - Modifier un utilisateur (users:manage permission)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("users:manage")
    const { id } = validateParams(await params, IdParamSchema)

    const body = await request.json()
    const validated = UpdateUserSchema.parse(body)

    // Vérifier si l'utilisateur existe
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      throw new ApiError(404, "Utilisateur non trouvé", "NOT_FOUND")
    }

    const user = await prisma.user.update({
      where: { id },
      data: validated,
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    return successResponse({
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
    })
  } catch (error) {
    return errorResponse(error)
  }
}
