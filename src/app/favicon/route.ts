import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { s3Client, BUCKET, getFaviconKey } from "@/lib/s3"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { readFileSync } from "fs"
import { join } from "path"

// Dynamic favicon route
export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    })

    if (settings?.faviconKey) {
      // Fetch from S3
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: getFaviconKey("ico"),
      })

      const response = await s3Client.send(command)
      const uint8Array = await response.Body?.transformToByteArray()

      if (uint8Array) {
        const buffer = Buffer.from(uint8Array)
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "image/x-icon",
            "Cache-Control": "public, max-age=86400", // 24h cache
          },
        })
      }
    }

    // Fallback to default favicon
    const defaultFavicon = readFileSync(
      join(process.cwd(), "src/app/favicon.ico")
    )

    return new NextResponse(defaultFavicon, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    // Return default on error
    const defaultFavicon = readFileSync(
      join(process.cwd(), "src/app/favicon.ico")
    )
    return new NextResponse(defaultFavicon, {
      headers: { "Content-Type": "image/x-icon" },
    })
  }
}
