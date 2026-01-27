import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { UpdateChurchSchema } from "@/lib/schemas"

type RouteParams = {
  params: Promise<{ id: string }>
}

// GET /api/churches/[id] - Récupérer une église
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const church = await prisma.church.findUnique({
      where: { id },
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    if (!church) {
      throw new ApiError(404, "Église non trouvée", "NOT_FOUND")
    }

    return successResponse(church)
  } catch (error) {
    return errorResponse(error)
  }
}

// PATCH /api/churches/[id] - Modifier une église (churches:manage permission)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("churches:manage")
    const { id } = await params

    const body = await request.json()
    const validated = UpdateChurchSchema.parse(body)

    // Vérifier si l'église existe
    const existing = await prisma.church.findUnique({ where: { id } })
    if (!existing) {
      throw new ApiError(404, "Église non trouvée", "NOT_FOUND")
    }

    // Si on change le nom, vérifier qu'il n'existe pas déjà
    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.church.findUnique({
        where: { name: validated.name },
      })
      if (duplicate) {
        throw new ApiError(409, "Une église avec ce nom existe déjà", "DUPLICATE_NAME")
      }
    }

    const church = await prisma.church.update({
      where: { id },
      data: validated,
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    return successResponse(church)
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/churches/[id] - Supprimer une église (churches:manage permission)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("churches:manage")
    const { id } = await params

    // Vérifier si l'église a des événements
    const church = await prisma.church.findUnique({
      where: { id },
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    if (!church) {
      throw new ApiError(404, "Église non trouvée", "NOT_FOUND")
    }

    if (church._count.events > 0) {
      throw new ApiError(
        400,
        `Impossible de supprimer cette église car elle a ${church._count.events} événement(s) associé(s)`,
        "HAS_EVENTS"
      )
    }

    await prisma.church.delete({ where: { id } })

    return successResponse({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
