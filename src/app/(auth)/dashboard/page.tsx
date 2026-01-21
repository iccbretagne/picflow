import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, Button } from "@/components/ui"

type EventStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED"

const statusLabels: Record<EventStatus, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente",
  REVIEWED: "Validé",
  ARCHIVED: "Archivé",
}

const statusColors: Record<EventStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  REVIEWED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-blue-100 text-blue-700",
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/")
  }

  const events = await prisma.event.findMany({
    where: { createdById: session.user.id },
    orderBy: { date: "desc" },
    include: {
      _count: {
        select: { photos: true },
      },
      photos: {
        select: { status: true },
      },
    },
  })

  const eventsWithStats = events.map((event) => ({
    ...event,
    approvedCount: event.photos.filter((p) => p.status === "APPROVED").length,
    rejectedCount: event.photos.filter((p) => p.status === "REJECTED").length,
    pendingCount: event.photos.filter((p) => p.status === "PENDING").length,
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes événements</h1>
          <p className="text-gray-600 mt-1">
            Gérez vos événements et validez les photos
          </p>
        </div>
        <Link href="/events/new">
          <Button>
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nouvel événement
          </Button>
        </Link>
      </div>

      {/* Events list */}
      {eventsWithStats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun événement
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre premier événement pour commencer à uploader des photos.
            </p>
            <Link href="/events/new">
              <Button>Créer un événement</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventsWithStats.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-6">
                  {/* Status badge */}
                  <div className="flex justify-between items-start mb-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[event.status as EventStatus]}`}
                    >
                      {statusLabels[event.status as EventStatus]}
                    </span>
                    <span className="text-sm text-gray-500">
                      {event._count.photos} photos
                    </span>
                  </div>

                  {/* Event info */}
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {event.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{event.church}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>

                  {/* Stats */}
                  {event._count.photos > 0 && (
                    <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-600">
                          {event.approvedCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs text-gray-600">
                          {event.rejectedCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-xs text-gray-600">
                          {event.pendingCount}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
