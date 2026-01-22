"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, Button, Input, Select, Textarea } from "@/components/ui"
import type { ChurchResponse } from "@/lib/schemas"

export default function NewEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [churches, setChurches] = useState<ChurchResponse[]>([])
  const [loadingChurches, setLoadingChurches] = useState(true)

  useEffect(() => {
    fetchChurches()
  }, [])

  async function fetchChurches() {
    try {
      const res = await fetch("/api/churches")
      const data = await res.json()
      setChurches(data.data || [])
    } catch (err) {
      console.error("Erreur lors du chargement des églises:", err)
    } finally {
      setLoadingChurches(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      date: new Date(formData.get("date") as string).toISOString(),
      churchId: formData.get("churchId") as string,
      description: (formData.get("description") as string) || undefined,
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Erreur lors de la création")
      }

      const { data: event } = await res.json()
      router.push(`/events/${event.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-icc-violet hover:text-icc-violet-dark font-medium mb-6 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Retour au dashboard
      </Link>

      <Card>
        <CardHeader>
          Nouvel événement
        </CardHeader>

        <CardContent>
          <p className="text-sm text-gray-700 mb-6">
            Créez un événement pour commencer à uploader des photos
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border-2 border-icc-rouge/20 rounded-lg text-icc-rouge text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Name */}
            <Input
              id="name"
              name="name"
              label="Nom de l'événement"
              type="text"
              required
              maxLength={255}
              placeholder="Ex: Culte du 19 janvier"
            />

            {/* Date */}
            <Input
              id="date"
              name="date"
              label="Date"
              type="datetime-local"
              required
            />

            {/* Church */}
            {loadingChurches ? (
              <div className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Chargement...
              </div>
            ) : churches.length === 0 ? (
              <div className="space-y-3">
                <div className="w-full px-4 py-3 border-2 border-amber-300 bg-amber-50 rounded-lg text-amber-700 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Aucune église disponible. Créez-en une d'abord.
                </div>
                <Link href="/churches">
                  <Button type="button" variant="secondary" className="w-full">
                    Gérer les églises
                  </Button>
                </Link>
              </div>
            ) : (
              <Select
                id="churchId"
                name="churchId"
                label="Église"
                defaultValue=""
                required
              >
                <option value="">Sélectionnez une église</option>
                {churches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </Select>
            )}

            {/* Description */}
            <Textarea
              id="description"
              name="description"
              label="Description"
              rows={3}
              maxLength={1000}
              placeholder="Description optionnelle de l'événement"
            />

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" loading={loading} className="flex-1">
                Créer l'événement
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="secondary">
                  Annuler
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
