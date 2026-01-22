"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export function HeaderLogo() {
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

  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt="PicFlow" className="h-8 object-contain" />
      ) : (
        <>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
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
          <span className="font-semibold text-gray-900">PicFlow</span>
        </>
      )}
    </Link>
  )
}
