import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateParams, errorResponse, ApiError } from "@/lib/api-utils"
import { validateShareToken } from "@/lib/tokens"
import { getSignedOriginalUrl } from "@/lib/s3"
import { TokenParamSchema } from "@/lib/schemas"
import archiver from "archiver"

type RouteParams = { params: Promise<{ token: string }> }

// GET /api/download/[token]/zip - Download all approved photos as ZIP
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = validateParams(await params, TokenParamSchema)

    const shareToken = await validateShareToken(token)
    const event = shareToken.event

    if (event) {
      const approvedPhotos = await prisma.media.findMany({
        where: { eventId: event.id, type: "PHOTO", status: "APPROVED" },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      })

      if (approvedPhotos.length === 0) {
        throw new ApiError(404, "No approved photos to download", "NO_PHOTOS")
      }

      // Create ZIP archive
      const archive = archiver("zip", {
        zlib: { level: 5 }, // Balanced compression
      })

      // Generate safe filename for ZIP
      const safeName = event.name
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/gi, "")
        .replace(/\s+/g, "_")
        .slice(0, 50)
      const zipFilename = `${safeName}_photos.zip`

      // Create a readable stream from the archive
      const stream = new ReadableStream({
        start(controller) {
          archive.on("data", (chunk) => {
            controller.enqueue(chunk)
          })

          archive.on("end", () => {
            controller.close()
          })

          archive.on("error", (err) => {
            controller.error(err)
          })
        },
      })

      // Add photos to archive
      const addPhotosToArchive = async () => {
      for (const photo of approvedPhotos) {
        try {
          const latest = photo.versions[0]
          if (!latest) {
            continue
          }

          const url = await getSignedOriginalUrl(latest.originalKey)

            // Fetch the photo
            const response = await fetch(url)
            if (!response.ok) {
              console.error(`Failed to fetch photo ${photo.id}`)
              continue
            }

            const buffer = await response.arrayBuffer()

            // Add to archive with original filename
          archive.append(Buffer.from(buffer), { name: photo.filename })
        } catch (err) {
          console.error(`Error adding photo ${photo.id} to ZIP:`, err)
        }
      }

        // Finalize the archive
        await archive.finalize()
      }

      // Start adding photos (don't await - it runs in parallel with streaming)
      addPhotosToArchive()

      return new Response(stream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFilename}"`,
        },
      })
    }

    if (!shareToken.projectId) {
      throw new ApiError(400, "This token is not associated with a project", "INVALID_TOKEN_TYPE")
    }

    const project = await prisma.project.findUnique({
      where: { id: shareToken.projectId },
      include: {
        media: {
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    if (!project) {
      throw new ApiError(404, "Project not found", "NOT_FOUND")
    }

    const approvedMedia = project.media.filter(
      (m) => m.status === "APPROVED" || m.status === "FINAL_APPROVED"
    )

    if (approvedMedia.length === 0) {
      throw new ApiError(404, "No approved media to download", "NO_MEDIA")
    }

    const archive = archiver("zip", {
      zlib: { level: 5 },
    })

    const safeName = project.name
      .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/gi, "")
      .replace(/\s+/g, "_")
      .slice(0, 50)
    const zipFilename = `${safeName}_media.zip`

    // Create a readable stream from the archive
    const stream = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk) => {
          controller.enqueue(chunk)
        })

        archive.on("end", () => {
          controller.close()
        })

        archive.on("error", (err) => {
          controller.error(err)
        })
      },
    })

    // Add photos to archive
    const addPhotosToArchive = async () => {
      for (const media of approvedMedia) {
        try {
          const latestVersion = media.versions[0]
          if (!latestVersion) {
            continue
          }

          // Get signed URL for the original media
          const url = await getSignedOriginalUrl(latestVersion.originalKey)

          // Fetch the media
          const response = await fetch(url)
          if (!response.ok) {
            console.error(`Failed to fetch media ${media.id}`)
            continue
          }

          const buffer = await response.arrayBuffer()

          // Add to archive with original filename
          archive.append(Buffer.from(buffer), { name: media.filename })
        } catch (err) {
          console.error(`Error adding media ${media.id} to ZIP:`, err)
        }
      }

      // Finalize the archive
      await archive.finalize()
    }

    // Start adding photos (don't await - it runs in parallel with streaming)
    addPhotosToArchive()

    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
