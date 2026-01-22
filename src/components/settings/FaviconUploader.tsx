"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui"

export function FaviconUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [hasFavicon, setHasFavicon] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch current favicon status on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.hasFavicon) {
          setHasFavicon(true)
        }
      })
      .catch(() => {})
  }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/settings/favicon", {
        method: "POST",
        body: formData,
      })

      const response = await res.json()

      if (!res.ok) {
        throw new Error(response.error?.message || "Erreur lors de l'upload")
      }

      // Create preview from file
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
        setHasFavicon(false) // Hide old status
      }
      reader.readAsDataURL(file)

      // Refresh page to update favicon
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer le favicon actuel ?")) return

    setUploading(true)
    try {
      const res = await fetch("/api/settings/favicon", { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur lors de la suppression")

      setHasFavicon(false)
      setPreviewUrl(null)
      setTimeout(() => window.location.reload(), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current/Preview Favicon */}
      {(hasFavicon || previewUrl) && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Nouveau favicon"
              className="w-8 h-8 object-contain"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
              <svg
                className="w-4 h-4 text-gray-500"
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
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {previewUrl ? "Nouveau favicon" : "Favicon actuel"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={uploading}
          >
            Supprimer
          </Button>
        </div>
      )}

      {/* Upload Input */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) =>
            e.target.files?.[0] && handleUpload(e.target.files[0])
          }
          className="hidden"
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          variant="primary"
        >
          {uploading
            ? "Upload en cours..."
            : hasFavicon
              ? "Remplacer le favicon"
              : "Uploader un favicon"}
        </Button>
        <p className="text-xs text-gray-500 mt-2">
          PNG ou JPEG carré • Max 5 Mo • Minimum 512x512px recommandé
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
