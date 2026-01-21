"use client"

type PhotoStatus = "PENDING" | "APPROVED" | "REJECTED"

interface Photo {
  id: string
  filename: string
  thumbnailUrl: string
  status: PhotoStatus
  uploadedAt: Date
}

interface PhotoGridProps {
  photos: Photo[]
}

const statusIcons: Record<PhotoStatus, React.ReactNode> = {
  PENDING: (
    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
  APPROVED: (
    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  REJECTED: (
    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
}

const statusLabels: Record<PhotoStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REJECTED: "Rejetée",
}

export function PhotoGrid({ photos }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
        >
          <img
            src={photo.thumbnailUrl}
            alt={photo.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            {statusIcons[photo.status]}
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <div className="text-white">
              <p className="text-sm font-medium truncate">{photo.filename}</p>
              <p className="text-xs opacity-75">{statusLabels[photo.status]}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
