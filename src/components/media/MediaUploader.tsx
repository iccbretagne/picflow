"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"
import type { MediaType } from "@/lib/schemas"

interface UploadedMedia {
  id: string
  type: MediaType
  filename: string
  thumbnailUrl: string
}

interface UploadError {
  filename: string
  error: string
}

interface UploadProgress {
  filename: string
  progress: number // 0-100
  status: "pending" | "uploading" | "processing" | "done" | "error"
  error?: string
}

interface MediaUploaderProps {
  projectId?: string
  eventId?: string
  acceptedTypes?: ("VISUAL" | "VIDEO")[]
}

const VISUAL_MIME_TYPES = ["image/png", "image/svg+xml", "application/pdf"]
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"]

function getMimeTypes(acceptedTypes: ("VISUAL" | "VIDEO")[]): string {
  const mimes: string[] = []
  if (acceptedTypes.includes("VISUAL")) mimes.push(...VISUAL_MIME_TYPES)
  if (acceptedTypes.includes("VIDEO")) mimes.push(...VIDEO_MIME_TYPES)
  return mimes.join(",")
}

function getMediaType(mimeType: string): MediaType | null {
  if (VISUAL_MIME_TYPES.includes(mimeType)) return "VISUAL"
  if (VIDEO_MIME_TYPES.includes(mimeType)) return "VIDEO"
  return null
}

// Extract video thumbnail using canvas
async function extractVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      // Seek to 1 second or 10% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx?.drawImage(video, 0, 0)

      const dataUrl = canvas.toDataURL("image/webp", 0.8)
      URL.revokeObjectURL(video.src)
      resolve(dataUrl)
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error("Could not load video"))
    }

    video.src = URL.createObjectURL(file)
  })
}

export function MediaUploader({
  projectId,
  eventId,
  acceptedTypes = ["VISUAL", "VIDEO"],
}: MediaUploaderProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map())
  const [results, setResults] = useState<{
    uploaded: UploadedMedia[]
    errors: UploadError[]
  } | null>(null)

  const isUploading = Array.from(uploads.values()).some(
    (u) => u.status === "uploading" || u.status === "processing"
  )

  function updateUpload(filename: string, update: Partial<UploadProgress>) {
    setUploads((prev) => {
      const next = new Map(prev)
      const existing = next.get(filename) || {
        filename,
        progress: 0,
        status: "pending" as const,
      }
      next.set(filename, { ...existing, ...update })
      return next
    })
  }

  async function uploadFile(file: File): Promise<UploadedMedia> {
    const mediaType = getMediaType(file.type)
    if (!mediaType) {
      throw new Error(`Type de fichier non supporté: ${file.type}`)
    }

    updateUpload(file.name, { status: "uploading", progress: 0 })

    // Step 1: Request presigned URL
    const signRes = await fetch("/api/media/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        type: mediaType,
        projectId,
        eventId,
      }),
    })

    if (!signRes.ok) {
      const error = await signRes.json()
      throw new Error(error.error?.message || "Erreur lors de la demande d'upload")
    }

    const { data: signData } = await signRes.json()
    const { uploadId, url } = signData

    // Step 2: Upload to S3 with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          updateUpload(file.name, { progress })
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error("Network error during upload"))

      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    })

    updateUpload(file.name, { status: "processing", progress: 100 })

    // Step 3: Extract thumbnail for videos
    let thumbnailDataUrl: string | undefined
    if (mediaType === "VIDEO") {
      try {
        thumbnailDataUrl = await extractVideoThumbnail(file)
      } catch (e) {
        console.error("Failed to extract video thumbnail:", e)
        // Continue without thumbnail - server will fail with helpful error
      }
    }

    // Step 4: Confirm upload
    const confirmRes = await fetch("/api/media/upload/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        thumbnailDataUrl,
      }),
    })

    if (!confirmRes.ok) {
      const error = await confirmRes.json()
      throw new Error(error.error?.message || "Erreur lors de la confirmation")
    }

    const { data: media } = await confirmRes.json()

    updateUpload(file.name, { status: "done" })

    return media
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setResults(null)
    const fileArray = Array.from(files)

    // Initialize upload state for all files
    for (const file of fileArray) {
      updateUpload(file.name, { status: "pending", progress: 0 })
    }

    const uploaded: UploadedMedia[] = []
    const errors: UploadError[] = []

    // Upload files sequentially to avoid overwhelming the server
    for (const file of fileArray) {
      try {
        const media = await uploadFile(file)
        uploaded.push(media)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue"
        errors.push({ filename: file.name, error: message })
        updateUpload(file.name, { status: "error", error: message })
      }
    }

    setResults({ uploaded, errors })

    // Clear uploads after a delay
    setTimeout(() => {
      setUploads(new Map())
    }, 3000)

    // Refresh page to show new media
    if (uploaded.length > 0) {
      router.refresh()
    }

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!isUploading) {
      handleFiles(e.dataTransfer.files)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  const uploadList = Array.from(uploads.values())
  const hasActiveUploads = uploadList.length > 0

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isUploading
            ? "border-icc-violet/40 bg-icc-violet-light/30"
            : "border-gray-300 hover:border-icc-violet/60 hover:bg-gray-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={getMimeTypes(acceptedTypes)}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="media-input"
          disabled={isUploading}
        />

        {hasActiveUploads ? (
          <div className="space-y-4">
            {uploadList.map((upload) => (
              <div key={upload.filename} className="text-left">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 truncate max-w-[70%]">
                    {upload.filename}
                  </span>
                  <span className="text-gray-500">
                    {upload.status === "uploading" && `${upload.progress}%`}
                    {upload.status === "processing" && "Traitement..."}
                    {upload.status === "done" && "Terminé"}
                    {upload.status === "error" && "Erreur"}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      upload.status === "error"
                        ? "bg-icc-rouge"
                        : upload.status === "done"
                        ? "bg-green-500"
                        : "bg-icc-violet"
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
                {upload.error && (
                  <p className="text-xs text-icc-rouge mt-1">{upload.error}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-4 bg-icc-violet-light rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-icc-violet"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">
              Glissez-déposez vos fichiers ici
            </p>
            <p className="text-sm text-gray-500 mb-4">ou</p>
            <label htmlFor="media-input">
              <Button
                type="button"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Parcourir
              </Button>
            </label>
            <p className="text-xs text-gray-400 mt-4">
              {acceptedTypes.includes("VISUAL") && "PNG, SVG, PDF"}
              {acceptedTypes.includes("VISUAL") && acceptedTypes.includes("VIDEO") && " • "}
              {acceptedTypes.includes("VIDEO") && "MP4, MOV, WebM (max 500 Mo)"}
            </p>
          </>
        )}
      </div>

      {/* Results */}
      {results && !hasActiveUploads && (
        <div className="space-y-3">
          {results.uploaded.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">
                {results.uploaded.length} fichier(s) uploadé(s) avec succès
              </p>
            </div>
          )}
          {results.errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-icc-rouge/20 rounded-lg">
              <p className="text-icc-rouge font-medium mb-2">
                {results.errors.length} erreur(s)
              </p>
              <ul className="text-sm text-icc-rouge/80 space-y-1">
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
