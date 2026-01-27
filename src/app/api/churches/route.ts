import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { CreateChurchSchema } from "@/lib/schemas"

// GET /api/churches - Liste toutes les églises
export async function GET() {
  try {
    const churches = await prisma.church.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    return successResponse(churches)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/churches - Créer une nouvelle église (churches:manage permission)
export async function POST(request: NextRequest) {
  try {
    await requirePermission("churches:manage")

    const body = await request.json()
    const validated = CreateChurchSchema.parse(body)

    // Vérifier que le nom n'existe pas déjà
    const existing = await prisma.church.findUnique({
      where: { name: validated.name },
    })

    if (existing) {
      throw new ApiError(409, "Une église avec ce nom existe déjà", "DUPLICATE_NAME")
    }

    const church = await prisma.church.create({
      data: {
        name: validated.name,
        address: validated.address || null,
      },
      include: {
        _count: {
          select: { events: true },
        },
      },
    })

    return successResponse(church, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
