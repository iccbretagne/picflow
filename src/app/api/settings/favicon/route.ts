import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils"
import { uploadFile, getFaviconKey, deleteFile } from "@/lib/s3"
import { processFavicon } from "@/lib/sharp"
import { LOGO_ALLOWED_TYPES, LOGO_MAX_SIZE } from "@/lib/schemas"

// POST /api/settings/favicon - Upload new favicon (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

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

    // Process image
    const buffer = Buffer.from(await file.arrayBuffer())
    const processed = await processFavicon(buffer)

    // Upload new files to S3
    await Promise.all([
      uploadFile(getFaviconKey("original"), processed.original, "image/png"),
      uploadFile(getFaviconKey("ico"), processed.ico, "image/x-icon"),
      uploadFile(getFaviconKey("png192"), processed.png192, "image/png"),
      uploadFile(getFaviconKey("png512"), processed.png512, "image/png"),
    ])

    // Update database
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        faviconKey: getFaviconKey("original"),
        faviconFilename: file.name,
      },
      update: {
        faviconKey: getFaviconKey("original"),
        faviconFilename: file.name,
      },
    })

    // Delete old favicon files if they existed
    if (currentSettings?.faviconKey) {
      await Promise.all([
        deleteFile(getFaviconKey("original")),
        deleteFile(getFaviconKey("ico")),
        deleteFile(getFaviconKey("png192")),
        deleteFile(getFaviconKey("png512")),
      ]).catch(() => {}) // Ignore errors on cleanup
    }

    return successResponse({
      success: true,
      filename: file.name,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/settings/favicon - Remove favicon (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)

    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    })

    if (!settings?.faviconKey) {
      throw new ApiError(404, "No favicon configured", "NOT_FOUND")
    }

    // Delete from S3
    await Promise.all([
      deleteFile(getFaviconKey("original")),
      deleteFile(getFaviconKey("ico")),
      deleteFile(getFaviconKey("png192")),
      deleteFile(getFaviconKey("png512")),
    ])

    // Update database
    await prisma.appSettings.update({
      where: { id: "default" },
      data: {
        faviconKey: null,
        faviconFilename: null,
      },
    })

    return successResponse({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
