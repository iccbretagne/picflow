"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui"

export function LogoUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch current logo on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.logoUrl) {
          setCurrentLogo(data.data.logoUrl)
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
      const res = await fetch("/api/settings/logo", {
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
        setCurrentLogo(null) // Hide old logo
      }
      reader.readAsDataURL(file)

      // Refresh page to update header logo
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer le logo actuel ?")) return

    setUploading(true)
    try {
      const res = await fetch("/api/settings/logo", { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur lors de la suppression")

      setCurrentLogo(null)
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
      {/* Current/Preview Logo */}
      {(currentLogo || previewUrl) && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <img
            src={previewUrl || currentLogo!}
            alt="Logo actuel"
            className="h-16 object-contain"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {previewUrl ? "Nouveau logo" : "Logo actuel"}
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
          accept="image/png,image/jpeg,image/svg+xml"
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
            : currentLogo
              ? "Remplacer le logo"
              : "Uploader un logo"}
        </Button>
        <p className="text-xs text-gray-500 mt-2">
          PNG, JPEG ou SVG • Max 5 Mo • Fond transparent recommandé
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
