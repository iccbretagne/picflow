"use client"

import { useState } from "react"
import { Badge } from "@/components/ui"
import { MediaReviewModal, type MediaReviewItem } from "./MediaReviewModal"

type MediaStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DRAFT"
  | "IN_REVIEW"
  | "REVISION_REQUESTED"
  | "FINAL_APPROVED"

interface MediaReviewGridProps {
  media: MediaReviewItem[]
}

const statusLabels: Record<MediaStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Validé",
  REJECTED: "Rejeté",
  DRAFT: "Brouillon",
  IN_REVIEW: "En révision",
  REVISION_REQUESTED: "Révision demandée",
  FINAL_APPROVED: "Approuvé",
}

const statusVariants: Record<MediaStatus, "default" | "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  DRAFT: "default",
  IN_REVIEW: "info",
  REVISION_REQUESTED: "warning",
  FINAL_APPROVED: "success",
}

export function MediaReviewGrid({ media }: MediaReviewGridProps) {
  const [items, setItems] = useState(media)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? items.find((m) => m.id === selectedId) ?? null : null

  function updateStatus(id: string, status: MediaStatus) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)))
  }

  function updateMedia(id: string, updates: Partial<MediaReviewItem>) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
          >
            {m.type === "VIDEO" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbnailUrl}
                  alt={m.filename}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <Badge variant={statusVariants[m.status]} size="sm">
                {statusLabels[m.status]}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <MediaReviewModal
          media={selected}
          onClose={() => setSelectedId(null)}
          onStatusChange={updateStatus}
          onMediaUpdate={updateMedia}
        />
      )}
    </>
  )
}
