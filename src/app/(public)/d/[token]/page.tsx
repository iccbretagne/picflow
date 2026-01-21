"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui"

interface Photo {
  id: string
  filename: string
  thumbnailUrl: string
  width: number | null
  height: number | null
}

interface EventData {
  event: {
    id: string
    name: string
    date: string
    church: string
  }
  photos: Photo[]
}

export default function DownloadPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [downloadingAll, setDownloadingAll] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/download/${token}`)
        const response = await res.json()

        if (!res.ok) {
          throw new Error(response.error?.message || "Impossible de charger les photos")
        }

        setData(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  async function downloadPhoto(photoId: string, filename: string): Promise<boolean> {
    setDownloading((prev) => new Set(prev).add(photoId))

    try {
      // Get signed download URL
      const res = await fetch(`/api/download/${token}/photo/${photoId}`)
      const response = await res.json()

      if (!res.ok) {
        throw new Error(response.error?.message || "Erreur de téléchargement")
      }

      // Use iframe to trigger download (avoids CORS and popup blockers)
      const iframe = document.createElement("iframe")
      iframe.style.display = "none"
      iframe.src = response.data.url
      document.body.appendChild(iframe)

      // Clean up iframe after download starts
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 5000)

      return true
    } catch (err) {
      console.error("Download error:", err)
      return false
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    }
  }

  async function downloadAll() {
    if (!data || data.photos.length === 0) return

    setDownloadingAll(true)

    let successCount = 0
    let errorCount = 0

    // Download photos sequentially with longer delay
    for (const photo of data.photos) {
      const success = await downloadPhoto(photo.id, photo.filename)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
      // Longer delay between downloads for browser to process
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setDownloadingAll(false)

    if (errorCount > 0) {
      alert(`${successCount} téléchargée(s), ${errorCount} erreur(s)`)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 mt-4">Chargement des photos...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Lien invalide ou expiré
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // No photos state
  if (data.photos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-bold text-gray-900">{data.event.name}</h1>
            <p className="text-gray-600">{data.event.church}</p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(data.event.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Aucune photo disponible
          </h2>
          <p className="text-gray-600">
            Les photos validées apparaîtront ici une fois la validation terminée.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.event.name}</h1>
              <p className="text-gray-600">{data.event.church}</p>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(data.event.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {data.photos.length} photo{data.photos.length > 1 ? "s" : ""} disponible{data.photos.length > 1 ? "s" : ""}
              </span>
              <Button
                onClick={downloadAll}
                loading={downloadingAll}
                disabled={downloadingAll}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Tout télécharger
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Photo grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.photos.map((photo) => {
            const isDownloading = downloading.has(photo.id)

            return (
              <div
                key={photo.id}
                className="relative group bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-100">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => downloadPhoto(photo.id, photo.filename)}
                    disabled={isDownloading}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Filename */}
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate" title={photo.filename}>
                    {photo.filename}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-6 mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>PicFlow - {data.event.church}</p>
        </div>
      </footer>
    </div>
  )
}
