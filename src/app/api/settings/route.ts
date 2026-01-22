import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { getSignedLogoUrl, getLogoKey } from "@/lib/s3"

// GET /api/settings - Fetch current app settings (public, no auth)
export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    })

    if (!settings || (!settings.logoKey && !settings.faviconKey)) {
      return successResponse({
        hasLogo: false,
        hasFavicon: false,
        logoUrl: null,
        faviconUrl: null,
      })
    }

    // Generate signed URLs for current session
    const logoUrl = settings.logoKey
      ? await getSignedLogoUrl(getLogoKey("header"))
      : null

    const faviconUrl = null // Favicon will use dedicated route /favicon

    return successResponse({
      hasLogo: !!settings.logoKey,
      hasFavicon: !!settings.faviconKey,
      logoUrl,
      faviconUrl,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
