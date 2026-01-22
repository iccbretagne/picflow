"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui"

type Church = {
  id: string
  name: string
}

type EventStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED"

const statusOptions: { value: EventStatus | ""; label: string }[] = [
  { value: "", label: "Tous les statuts" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "PENDING_REVIEW", label: "En attente" },
  { value: "REVIEWED", label: "Validé" },
  { value: "ARCHIVED", label: "Archivé" },
]

export function DashboardFilters({ churches }: { churches: Church[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentChurchId = searchParams.get("churchId") || ""
  const currentStatus = searchParams.get("status") || ""

  function updateFilters(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearFilters() {
    router.push("/dashboard")
  }

  const hasActiveFilters = currentChurchId || currentStatus

  return (
    <div className="mb-6 p-5 bg-white border-2 border-icc-violet/20 rounded-xl shadow-sm">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Church filter */}
        <div className="flex-1">
          <Select
            id="church-filter"
            label="Église"
            value={currentChurchId}
            onChange={(e) => updateFilters("churchId", e.target.value)}
          >
            <option value="">Toutes les églises</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Status filter */}
        <div className="flex-1">
          <Select
            id="status-filter"
            label="Statut"
            value={currentStatus}
            onChange={(e) => updateFilters("status", e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 text-sm font-medium text-icc-violet hover:text-white hover:bg-icc-violet-light hover:bg-icc-violet rounded-lg transition-all duration-200 whitespace-nowrap"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
