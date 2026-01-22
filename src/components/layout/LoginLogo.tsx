"use client"

import { useEffect, useState } from "react"

export function LoginLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.logoUrl) {
          setLogoUrl(data.data.logoUrl)
        }
      })
      .catch(() => {})
  }, [])

  if (logoUrl) {
    return (
      <div className="mb-8">
        <img
          src={logoUrl}
          alt="PicFlow"
          className="h-32 mx-auto mb-4 object-contain"
        />
        <h1 className="text-3xl font-bold text-gray-900">PicFlow</h1>
        <p className="text-gray-600 mt-2">Validation de photos simple et rapide</p>
      </div>
    )
  }

  // Default SVG logo
  return (
    <div className="mb-8">
      <div className="w-20 h-20 mx-auto bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
        <svg
          className="w-12 h-12 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900">PicFlow</h1>
      <p className="text-gray-600 mt-2">Validation de photos simple et rapide</p>
    </div>
  )
}
