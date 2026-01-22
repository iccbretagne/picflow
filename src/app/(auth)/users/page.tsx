"use client"

import { useState, useEffect } from "react"
import { Button, Card, CardContent, Badge, Select } from "@/components/ui"
import type { UserResponse, UserRole, UserStatus } from "@/lib/schemas"

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrateur",
  MEDIA: "Équipe média",
}

const statusConfig: Record<UserStatus, { label: string; variant: "warning" | "success" | "danger" }> = {
  PENDING: { label: "En attente", variant: "warning" },
  ACTIVE: { label: "Actif", variant: "success" },
  REJECTED: { label: "Rejeté", variant: "danger" },
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<UserStatus | "">("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [filter])

  async function fetchUsers() {
    try {
      const url = filter
        ? `/api/users?status=${filter}`
        : "/api/users"
      const res = await fetch(url)
      const data = await res.json()
      setUsers(data.data || [])
    } catch (err) {
      setError("Erreur lors du chargement des utilisateurs")
    } finally {
      setLoading(false)
    }
  }

  async function updateUser(id: string, updates: { role?: UserRole; status?: UserStatus }) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors de la mise à jour")
      }

      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inconnue")
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">Chargement...</div>
      </div>
    )
  }

  const pendingCount = users.filter((u) => u.status === "PENDING").length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-icc-violet">Utilisateurs</h1>
          <p className="text-gray-700 mt-1">
            Gérez les accès et les rôles des utilisateurs
          </p>
          {pendingCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-amber-700 font-medium text-sm">
                {pendingCount} utilisateur{pendingCount > 1 ? 's' : ''} en attente d'approbation
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === ""
              ? "bg-icc-violet text-white shadow-md"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-icc-violet/40"
          }`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilter("PENDING")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === "PENDING"
              ? "bg-amber-500 text-white shadow-md"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-amber-300"
          }`}
        >
          En attente
        </button>
        <button
          onClick={() => setFilter("ACTIVE")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === "ACTIVE"
              ? "bg-green-500 text-white shadow-md"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-green-300"
          }`}
        >
          Actifs
        </button>
        <button
          onClick={() => setFilter("REJECTED")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === "REJECTED"
              ? "bg-icc-rouge text-white shadow-md"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-icc-rouge/40"
          }`}
        >
          Rejetés
        </button>
      </div>

      {/* Users list */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border-2 border-icc-rouge/20 rounded-lg text-icc-rouge flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div className="space-y-4">
        {users.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-icc-violet-light flex items-center justify-center">
                <svg className="w-8 h-8 text-icc-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Aucun utilisateur trouvé</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {user.image && (
                      <img
                        src={user.image}
                        alt={user.name || user.email}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user.name || user.email}
                        </h3>
                        <Badge variant={statusConfig[user.status].variant} size="sm">
                          {statusConfig[user.status].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{user.email}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {roleLabels[user.role]} • {user._count?.events || 0} événement{(user._count?.events || 0) > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Inscrit le{" "}
                        {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:items-end">
                    {/* Status actions */}
                    {user.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateUser(user.id, { status: "ACTIVE" })}
                        >
                          Approuver
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => updateUser(user.id, { status: "REJECTED" })}
                        >
                          Rejeter
                        </Button>
                      </div>
                    )}
                    {user.status === "REJECTED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => updateUser(user.id, { status: "ACTIVE" })}
                      >
                        Approuver
                      </Button>
                    )}
                    {user.status === "ACTIVE" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => updateUser(user.id, { status: "REJECTED" })}
                      >
                        Révoquer
                      </Button>
                    )}

                    {/* Role toggle */}
                    {user.status === "ACTIVE" && (
                      <Select
                        value={user.role}
                        onChange={(e) =>
                          updateUser(user.id, { role: e.target.value as UserRole })
                        }
                        className="text-sm"
                      >
                        <option value="ADMIN">Administrateur</option>
                        <option value="MEDIA">Équipe média</option>
                      </Select>
                    )}
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
