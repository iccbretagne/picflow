"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

interface UploadedPhoto {
  id: string
  filename: string
  thumbnailUrl: string
}

interface UploadError {
  filename: string
  error: string
}

interface PhotoUploaderProps {
  eventId: string
}

export function PhotoUploader({ eventId }: PhotoUploaderProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    filename: string
  } | null>(null)
  const [results, setResults] = useState<{
    uploaded: UploadedPhoto[]
    errors: UploadError[]
  } | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    setResults(null)

    const formData = new FormData()
    formData.append("eventId", eventId)

    const fileArray = Array.from(files)
    for (const file of fileArray) {
      formData.append("files", file)
    }

    setProgress({ current: 0, total: fileArray.length, filename: fileArray[0].name })

    try {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors de l'upload")
      }

      setResults({
        uploaded: data.uploaded,
        errors: data.errors,
      })

      // Refresh page to show new photos
      router.refresh()
    } catch (error) {
      setResults({
        uploaded: [],
        errors: [{ filename: "Upload", error: error instanceof Error ? error.message : "Erreur inconnue" }],
      })
    } finally {
      setUploading(false)
      setProgress(null)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          uploading
            ? "border-blue-300 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="photo-input"
          disabled={uploading}
        />

        {uploading ? (
          <div>
            <div className="w-12 h-12 mx-auto mb-4">
              <svg
                className="animate-spin w-full h-full text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
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
            </div>
            <p className="text-gray-700 font-medium">Upload en cours...</p>
            {progress && (
              <p className="text-sm text-gray-500 mt-1">
                {progress.current + 1} / {progress.total} - {progress.filename}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-400"
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
            <p className="text-gray-700 font-medium mb-1">
              Glissez-déposez vos photos ici
            </p>
            <p className="text-sm text-gray-500 mb-4">ou</p>
            <label htmlFor="photo-input">
              <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
                Parcourir
              </Button>
            </label>
            <p className="text-xs text-gray-400 mt-4">
              JPEG, PNG ou WebP • Max 20 Mo par photo
            </p>
          </>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          {results.uploaded.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">
                {results.uploaded.length} photo(s) uploadée(s) avec succès
              </p>
            </div>
          )}
          {results.errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium mb-2">
                {results.errors.length} erreur(s)
              </p>
              <ul className="text-sm text-red-600 space-y-1">
                {results.errors.map((err, i) => (
                  <li key={i}>
                    {err.filename}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
