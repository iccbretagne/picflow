import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getSignedThumbnailUrl } from "@/lib/s3"
import { Card, CardContent, CardHeader, Button, Badge } from "@/components/ui"
import { PhotoUploader } from "@/components/photos/PhotoUploader"
import { PhotoGrid } from "@/components/photos/PhotoGrid"
import { EventActions } from "@/components/events"

type EventStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED"
type PhotoStatus = "PENDING" | "APPROVED" | "REJECTED"

type EventWithRelations = {
  id: string
  name: string
  date: Date
  churchId: string
  church: {
    name: string
  }
  description: string | null
  status: EventStatus
  photos: {
    id: string
    filename: string
    thumbnailKey: string
    status: PhotoStatus
    uploadedAt: Date
  }[]
  shareTokens: {
    id: string
    type: "VALIDATOR" | "MEDIA"
    label: string | null
    expiresAt: Date | null
    usageCount: number
    createdAt: Date
  }[]
}

const statusConfig: Record<EventStatus, { label: string; variant: "default" | "warning" | "success" | "info" }> = {
  DRAFT: { label: "Brouillon", variant: "default" },
  PENDING_REVIEW: { label: "En attente de validation", variant: "warning" },
  REVIEWED: { label: "Validé", variant: "success" },
  ARCHIVED: { label: "Archivé", variant: "info" },
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

  const event = (await prisma.event.findUnique({
    where: { id, createdById: session.user.id },
    include: {
      church: {
        select: { name: true },
      },
      photos: {
        orderBy: { uploadedAt: "desc" },
      },
      shareTokens: {
        orderBy: { createdAt: "desc" },
      },
    },
  })) as EventWithRelations | null

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

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-icc-violet">{event.name}</h1>
            <Badge variant={statusConfig[event.status as EventStatus].variant}>
              {statusConfig[event.status as EventStatus].label}
            </Badge>
          </div>
          <p className="text-gray-700 font-medium">{event.church.name}</p>
          <p className="text-sm text-gray-600 mt-1">
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
            <p className="text-gray-700 mt-3">{event.description}</p>
          )}
        </div>

        <EventActions eventId={event.id} eventName={event.name} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-icc-violet">{stats.total}</p>
            <p className="text-sm text-gray-700 font-medium mt-1">Photos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-sm text-gray-700 font-medium mt-1">Validées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-icc-rouge">{stats.rejected}</p>
            <p className="text-sm text-gray-700 font-medium mt-1">Rejetées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-icc-jaune-dark">{stats.pending}</p>
            <p className="text-sm text-gray-700 font-medium mt-1">En attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Share tokens summary */}
      {event.shareTokens.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            Liens de partage
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-icc-violet/10">
              {event.shareTokens.slice(0, 3).map((token) => (
                <div
                  key={token.id}
                  className="px-6 py-4 flex justify-between items-center hover:bg-icc-violet-light/30 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {token.label || "Sans nom"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {token.type === "VALIDATOR" ? "Validation" : "Téléchargement"} •{" "}
                      {token.usageCount} utilisation{token.usageCount > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {token.expiresAt && new Date(token.expiresAt) < new Date() && (
                      <Badge variant="danger" size="sm">Expiré</Badge>
                    )}
                    <Link href={`/events/${event.id}/share`}>
                      <Button variant="ghost" size="sm">
                        Gérer
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload section */}
      <Card className="mb-8">
        <CardHeader>
          Ajouter des photos
        </CardHeader>
        <CardContent>
          <PhotoUploader eventId={event.id} />
        </CardContent>
      </Card>

      {/* Photos grid */}
      {photosWithUrls.length > 0 && (
        <Card>
          <CardHeader>
            Photos ({photosWithUrls.length})
          </CardHeader>
          <CardContent>
            <PhotoGrid photos={photosWithUrls} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
