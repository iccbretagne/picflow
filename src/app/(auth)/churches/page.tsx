"use client"

import { useState, useEffect } from "react"
import { Button, Card, CardContent, Input } from "@/components/ui"
import type { ChurchResponse } from "@/lib/schemas"

export default function ChurchesPage() {
  const [churches, setChurches] = useState<ChurchResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", address: "" })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchChurches()
  }, [])

  async function fetchChurches() {
    try {
      const res = await fetch("/api/churches")
      const data = await res.json()
      setChurches(data.data || [])
    } catch (err) {
      setError("Erreur lors du chargement des églises")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      const url = editing ? `/api/churches/${editing}` : "/api/churches"
      const method = editing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors de la sauvegarde")
      }

      setFormData({ name: "", address: "" })
      setShowForm(false)
      setEditing(null)
      fetchChurches()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette église ?")) return

    try {
      const res = await fetch(`/api/churches/${id}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors de la suppression")
      }

      fetchChurches()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inconnue")
    }
  }

  function startEdit(church: ChurchResponse) {
    setEditing(church.id)
    setFormData({ name: church.name, address: church.address || "" })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditing(null)
    setFormData({ name: "", address: "" })
    setShowForm(false)
    setError(null)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-icc-violet">Églises</h1>
          <p className="text-gray-700 mt-1">Gérez les églises de votre réseau</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "Nouvelle église"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-icc-violet mb-5">
              {editing ? "Modifier l'église" : "Nouvelle église"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Nom"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Ex: ICC Rennes"
              />
              <Input
                label="Adresse"
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Ex: 123 Rue de l'Église, 35000 Rennes"
              />
              {error && (
                <div className="p-4 bg-red-50 border-2 border-icc-rouge/20 rounded-lg text-sm text-icc-rouge flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary">
                  {editing ? "Sauvegarder" : "Créer"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEdit}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      <div className="space-y-4">
        {churches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-icc-violet-light flex items-center justify-center">
                <svg className="w-8 h-8 text-icc-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Aucune église enregistrée</p>
              <p className="text-gray-600 text-sm mt-1">Créez votre première église pour commencer</p>
            </CardContent>
          </Card>
        ) : (
          churches.map((church) => (
            <Card key={church.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-icc-violet">
                      {church.name}
                    </h3>
                    {church.address && (
                      <p className="text-sm text-gray-700 mt-1">{church.address}</p>
                    )}
                    {church._count && (
                      <p className="text-sm text-gray-600 mt-2">
                        {church._count.events} événement{church._count.events > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(church)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(church.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
