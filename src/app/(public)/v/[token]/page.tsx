"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui"

interface Photo {
  id: string
  filename: string
  thumbnailUrl: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

interface EventData {
  event: {
    id: string
    name: string
    date: string
    church: string
  }
  photos: Photo[]
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}

type Decision = "APPROVED" | "REJECTED"

export default function ValidationPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map())
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [undoAction, setUndoAction] = useState<{ photoId: string; prevStatus: Decision | null } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [summaryFilter, setSummaryFilter] = useState<"ALL" | "APPROVED" | "REJECTED">("ALL")
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/validate/${token}`)
        const response = await res.json()
        if (!res.ok) {
          throw new Error(response.error?.message || "Failed to load")
        }
        const eventData = response.data
        setData(eventData)

        // Initialize decisions from existing status
        const initialDecisions = new Map<string, Decision>()
        eventData.photos.forEach((photo: Photo) => {
          if (photo.status !== "PENDING") {
            initialDecisions.set(photo.id, photo.status as Decision)
          }
        })
        setDecisions(initialDecisions)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  const currentPhoto = data?.photos[currentIndex]
  const totalPhotos = data?.photos.length || 0

  // Decision handlers
  const makeDecision = useCallback(
    (decision: Decision) => {
      if (!currentPhoto) return

      const prevStatus = decisions.get(currentPhoto.id) || null
      setDecisions((prev) => new Map(prev).set(currentPhoto.id, decision))

      // Show undo toast
      setUndoAction({ photoId: currentPhoto.id, prevStatus })
      setTimeout(() => setUndoAction(null), 3000)

      // Move to next photo
      if (currentIndex < totalPhotos - 1) {
        setCurrentIndex((i) => i + 1)
      } else {
        setShowSummary(true)
      }
    },
    [currentPhoto, currentIndex, totalPhotos, decisions]
  )

  const skipPhoto = useCallback(() => {
    if (!currentPhoto) return
    if (currentIndex < totalPhotos - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setShowSummary(true)
    }
  }, [currentPhoto, currentIndex, totalPhotos])

  const undo = useCallback(() => {
    if (!undoAction) return

    if (undoAction.prevStatus) {
      setDecisions((prev) => new Map(prev).set(undoAction.photoId, undoAction.prevStatus!))
    } else {
      setDecisions((prev) => {
        const next = new Map(prev)
        next.delete(undoAction.photoId)
        return next
      })
    }
    setCurrentIndex((i) => Math.max(0, i - 1))
    setUndoAction(null)
  }, [undoAction])

  const toggleDecision = useCallback(
    (photoId: string) => {
      setDecisions((prev) => {
        const next = new Map(prev)
        const current = next.get(photoId)
        if (current === "APPROVED") {
          next.set(photoId, "REJECTED")
        } else {
          next.set(photoId, "APPROVED")
        }
        return next
      })
    },
    []
  )

  const submit = async () => {
    if (decisions.size === 0) return

    setSubmitting(true)
    try {
      const decisionsArray = Array.from(decisions.entries()).map(([photoId, status]) => ({
        photoId,
        status,
      }))

      const res = await fetch(`/api/validate/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: decisionsArray }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to submit")
      }

      // Show success
      alert("Validation enregistrée !")
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la soumission")
    } finally {
      setSubmitting(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSummary) return
      if (e.key === "ArrowLeft" || e.key === "x") {
        makeDecision("REJECTED")
      } else if (e.key === "ArrowRight" || e.key === "v") {
        makeDecision("APPROVED")
      } else if (e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        skipPhoto()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [makeDecision, skipPhoto, showSummary])

  useEffect(() => {
    if (!data || totalPhotos === 0) return
    if (currentIndex >= totalPhotos) {
      setShowSummary(true)
    }
  }, [data, totalPhotos, currentIndex])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (showSummary || !currentPhoto) return
      pointerIdRef.current = e.pointerId
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      setDragging(true)
      setDragX(0)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [showSummary, currentPhoto]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || pointerIdRef.current !== e.pointerId) return
      const deltaX = e.clientX - startXRef.current
      const deltaY = e.clientY - startYRef.current
      if (Math.abs(deltaY) > Math.abs(deltaX)) return
      setDragX(deltaX)
    },
    [dragging]
  )

  const handlePointerEnd = useCallback(() => {
    if (!dragging) return
    const threshold = 80
    const deltaX = dragX
    setDragging(false)
    setDragX(0)
    pointerIdRef.current = null
    if (Math.abs(deltaX) < threshold) return
    makeDecision(deltaX > 0 ? "APPROVED" : "REJECTED")
  }, [dragging, dragX, makeDecision])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">:(</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Summary view
  if (showSummary) {
    const approvedCount = Array.from(decisions.values()).filter((d) => d === "APPROVED").length
    const rejectedCount = Array.from(decisions.values()).filter((d) => d === "REJECTED").length
    const filteredPhotos = data.photos.filter((photo) => {
      if (summaryFilter === "ALL") return true
      return decisions.get(photo.id) === summaryFilter
    })

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setShowSummary(false)
              setSummaryFilter("ALL")
            }}
            className="text-blue-600"
          >
            &larr; Retour
          </button>
            <span className="font-medium">
              {approvedCount}/{totalPhotos} validées
            </span>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 sticky top-[52px] z-10">
          <button
            onClick={() => setSummaryFilter("ALL")}
            className={`px-3 py-1 text-sm rounded-full ${
              summaryFilter === "ALL"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Toutes ({totalPhotos})
          </button>
          <button
            onClick={() => setSummaryFilter("APPROVED")}
            className={`px-3 py-1 text-sm rounded-full ${
              summaryFilter === "APPROVED"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Validées ({approvedCount})
          </button>
          <button
            onClick={() => setSummaryFilter("REJECTED")}
            className={`px-3 py-1 text-sm rounded-full ${
              summaryFilter === "REJECTED"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Rejetées ({rejectedCount})
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-1 p-1">
          {filteredPhotos.map((photo) => {
            const decision = decisions.get(photo.id)
            return (
              <button
                key={photo.id}
                onClick={() => toggleDecision(photo.id)}
                className="relative aspect-square bg-gray-200"
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
                {decision && (
                  <div
                    className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
                      decision === "APPROVED" ? "bg-green-500" : "bg-red-500"
                    }`}
                  >
                    {decision === "APPROVED" ? "✓" : "✗"}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Submit button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <Button
            onClick={submit}
            loading={submitting}
            disabled={decisions.size === 0}
            className="w-full"
            size="lg"
          >
            Confirmer ({decisions.size}/{totalPhotos})
          </Button>
        </div>
      </div>
    )
  }

  // Main validation view
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-black/80 text-white px-4 py-3 flex items-center justify-between">
        <div className="text-sm truncate max-w-[60%]">{data.event.name}</div>
        <div className="text-sm">
          {currentIndex + 1}/{totalPhotos}
        </div>
      </header>

      {/* Photo */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ touchAction: "pan-y" }}
      >
        {currentPhoto && (
          <div
            className="relative"
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
              transition: dragging ? "none" : "transform 150ms ease-out",
            }}
          >
            <img
              src={currentPhoto.thumbnailUrl}
              alt={currentPhoto.filename}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
            {dragX !== 0 && (
              <div
                className={`absolute inset-0 flex items-start ${
                  dragX > 0 ? "justify-start" : "justify-end"
                }`}
                style={{ opacity: Math.min(Math.abs(dragX) / 120, 1) }}
              >
                <div
                  className={`m-6 w-12 h-12 rounded-full flex items-center justify-center text-2xl text-white ${
                    dragX > 0 ? "bg-green-500" : "bg-red-500"
                  }`}
                >
                  {dragX > 0 ? "✓" : "✗"}
                </div>
              </div>
            )}
            {dragX === 0 && (
              <div className="absolute top-4 left-4">
                {decisions.get(currentPhoto.id) === "APPROVED" ? (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-600 text-white">
                    Validée
                  </span>
                ) : decisions.get(currentPhoto.id) === "REJECTED" ? (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-600 text-white">
                    Rejetée
                  </span>
                ) : (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-700 text-white">
                    En attente
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {data && totalPhotos > 0 && decisions.size === totalPhotos && (
        <div className="bg-green-600 text-white text-sm px-4 py-2 text-center">
          Tout est traité.{" "}
          <button onClick={() => setShowSummary(true)} className="font-semibold underline">
            Voir le récap
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="bg-black/80 px-4 py-6 flex items-center justify-center gap-8">
        <button
          onClick={() => makeDecision("REJECTED")}
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center text-2xl hover:bg-red-600 transition-colors"
        >
          ✗
        </button>
        <button
          onClick={skipPhoto}
          className="w-12 h-12 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm hover:bg-gray-500 transition-colors"
        >
          Passer
        </button>
        <button
          onClick={() => setShowSummary(true)}
          className="w-12 h-12 rounded-full bg-gray-700 text-white flex items-center justify-center text-sm hover:bg-gray-600 transition-colors"
        >
          Recap
        </button>
        <button
          onClick={() => makeDecision("APPROVED")}
          className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl hover:bg-green-600 transition-colors"
        >
          ✓
        </button>
      </div>

      {/* Undo toast */}
      {undoAction && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-800 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <span>
            {decisions.get(undoAction.photoId) === "APPROVED" ? "Validée" : "Rejetée"}
          </span>
          <button onClick={undo} className="text-blue-400 font-medium">
            ANNULER
          </button>
        </div>
      )}
    </div>
  )
}
