import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getSignedThumbnailUrl } from "@/lib/s3"
import { Card, CardContent, CardHeader, Button } from "@/components/ui"
import { PhotoUploader } from "@/components/photos/PhotoUploader"
import { PhotoGrid } from "@/components/photos/PhotoGrid"

type EventStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED"

const statusLabels: Record<EventStatus, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  REVIEWED: "Validé",
  ARCHIVED: "Archivé",
}

const statusColors: Record<EventStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  REVIEWED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-blue-100 text-blue-700",
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    notFound()
  }

  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id, createdById: session.user.id },
    include: {
      photos: {
        orderBy: { uploadedAt: "desc" },
      },
      shareTokens: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!event) {
    notFound()
  }

  // Get signed URLs for thumbnails
  const photosWithUrls = await Promise.all(
    event.photos.map(async (photo) => ({
      ...photo,
      thumbnailUrl: await getSignedThumbnailUrl(photo.thumbnailKey),
    }))
  )

  const stats = {
    total: event.photos.length,
    approved: event.photos.filter((p) => p.status === "APPROVED").length,
    rejected: event.photos.filter((p) => p.status === "REJECTED").length,
    pending: event.photos.filter((p) => p.status === "PENDING").length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
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

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[event.status as EventStatus]}`}
            >
              {statusLabels[event.status as EventStatus]}
            </span>
          </div>
          <p className="text-gray-600">{event.church}</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(event.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {event.description && (
            <p className="text-gray-600 mt-3">{event.description}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Link href={`/events/${event.id}/share`}>
            <Button variant="secondary">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Partager
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600">Photos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-sm text-gray-600">Validées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-gray-600">Rejetées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">En attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Share tokens summary */}
      {event.shareTokens.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Liens de partage</h2>
              <Link href={`/events/${event.id}/share`}>
                <Button variant="ghost" size="sm">
                  Gérer
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {event.shareTokens.slice(0, 3).map((token) => (
                <div
                  key={token.id}
                  className="px-6 py-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {token.label || "Sans nom"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {token.type === "VALIDATOR" ? "Validation" : "Téléchargement"} •{" "}
                      {token.usageCount} utilisation(s)
                    </p>
                  </div>
                  {token.expiresAt && new Date(token.expiresAt) < new Date() && (
                    <span className="text-xs text-red-600 font-medium">Expiré</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload section */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Ajouter des photos</h2>
        </CardHeader>
        <CardContent>
          <PhotoUploader eventId={event.id} />
        </CardContent>
      </Card>

      {/* Photos grid */}
      {photosWithUrls.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              Photos ({photosWithUrls.length})
            </h2>
          </CardHeader>
          <CardContent>
            <PhotoGrid photos={photosWithUrls} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
