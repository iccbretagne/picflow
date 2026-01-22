import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, Button, Badge } from "@/components/ui"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"

type EventStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED"

const statusConfig: Record<EventStatus, { label: string; variant: "default" | "warning" | "success" | "info" }> = {
  DRAFT: { label: "Brouillon", variant: "default" },
  PENDING_REVIEW: { label: "En attente", variant: "warning" },
  REVIEWED: { label: "Validé", variant: "success" },
  ARCHIVED: { label: "Archivé", variant: "info" },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ churchId?: string; status?: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/")
  }

  const params = await searchParams
  const { churchId, status } = params

  type EventWithPhotos = {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
    date: Date
    churchId: string
    church: {
      name: string
    }
    description: string | null
    status: EventStatus
    createdById: string
    photos: { status: "PENDING" | "APPROVED" | "REJECTED" }[]
    _count: { photos: number }
  }

  const events = (await prisma.event.findMany({
    where: {
      createdById: session.user.id,
      ...(churchId && { churchId }),
      ...(status && { status: status as EventStatus }),
    },
    orderBy: { date: "desc" },
    include: {
      church: {
        select: { name: true },
      },
      _count: {
        select: { photos: true },
      },
      photos: {
        select: { status: true },
      },
    },
  })) as EventWithPhotos[]

  // Fetch churches for filter dropdown
  const churches = await prisma.church.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
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
          <h1 className="text-3xl font-bold text-icc-violet">Mes événements</h1>
          <p className="text-gray-700 mt-1">
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

      {/* Filters */}
      <DashboardFilters churches={churches} />

      {/* Events list */}
      {eventsWithStats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto bg-icc-violet-light rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-icc-violet"
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun événement
            </h3>
            <p className="text-gray-700 mb-6">
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
              <Card className="hover:border-icc-violet/60 hover:shadow-lg transition-all cursor-pointer h-full">
                <CardContent className="p-6">
                  {/* Status badge */}
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant={statusConfig[event.status as EventStatus].variant} size="sm">
                      {statusConfig[event.status as EventStatus].label}
                    </Badge>
                    <span className="text-sm font-medium text-gray-600">
                      {event._count.photos} photo{event._count.photos > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Event info */}
                  <h3 className="font-semibold text-gray-900 mb-1 text-lg">
                    {event.name}
                  </h3>
                  <p className="text-sm text-icc-violet font-medium mb-3">{event.church.name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>

                  {/* Stats */}
                  {event._count.photos > 0 && (
                    <div className="flex gap-4 mt-4 pt-4 border-t border-icc-violet/10">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs font-medium text-gray-700">
                          {event.approvedCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-icc-rouge" />
                        <span className="text-xs font-medium text-gray-700">
                          {event.rejectedCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-icc-jaune-dark" />
                        <span className="text-xs font-medium text-gray-700">
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
