import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth"
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { uploadFile, getLogoKey, deleteFile } from "@/lib/s3"
import { processLogo } from "@/lib/sharp"
import { LOGO_ALLOWED_TYPES, LOGO_MAX_SIZE } from "@/lib/schemas"

// POST /api/settings/logo - Upload new logo (settings:manage permission)
export async function POST(request: NextRequest) {
  try {
    await requirePermission("settings:manage")

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      throw new ApiError(400, "No file provided", "MISSING_FILE")
    }

    // Validate file
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      throw new ApiError(
        400,
        "Invalid file type. Use PNG, JPEG or SVG",
        "INVALID_TYPE"
      )
    }

    if (file.size > LOGO_MAX_SIZE) {
      throw new ApiError(
        400,
        `File too large. Max ${LOGO_MAX_SIZE / 1024 / 1024}MB`,
        "FILE_TOO_LARGE"
      )
    }

    // Get current settings to delete old files later
    const currentSettings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    })

    // Delete old logo files before uploading new ones (same keys)
    if (currentSettings?.logoKey) {
      await Promise.all([
        deleteFile(getLogoKey("original")),
        deleteFile(getLogoKey("header")),
        deleteFile(getLogoKey("login")),
      ]).catch(() => {}) // Ignore errors on cleanup
    }

    // Process image
    const buffer = Buffer.from(await file.arrayBuffer())
    const processed = await processLogo(buffer)

    // Upload new files to S3
    await Promise.all([
      uploadFile(getLogoKey("original"), processed.original, "image/png"),
      uploadFile(getLogoKey("header"), processed.header, "image/png"),
      uploadFile(getLogoKey("login"), processed.login, "image/png"),
    ])

    // Update database
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        logoKey: getLogoKey("original"),
        logoFilename: file.name,
      },
      update: {
        logoKey: getLogoKey("original"),
        logoFilename: file.name,
      },
    })

    return successResponse({
      success: true,
      filename: file.name,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/settings/logo - Remove logo (settings:manage permission)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission("settings:manage")

    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    })

    if (!settings?.logoKey) {
      throw new ApiError(404, "No logo configured", "NOT_FOUND")
    }

    // Delete from S3
    await Promise.all([
      deleteFile(getLogoKey("original")),
      deleteFile(getLogoKey("header")),
      deleteFile(getLogoKey("login")),
    ])

    // Update database
    await prisma.appSettings.update({
      where: { id: "default" },
      data: {
        logoKey: null,
        logoFilename: null,
      },
    })

    return successResponse({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
