"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type NavItem = {
  href: string
  label: string
  match: string[]
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", match: ["/dashboard", "/events"] },
  { href: "/churches", label: "Églises", match: ["/churches"] },
  { href: "/users", label: "Utilisateurs", match: ["/users"] },
  { href: "/settings", label: "Paramètres", match: ["/settings"] },
]

function isActive(pathname: string, item: NavItem) {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function AuthNav() {
  const pathname = usePathname() || ""

  return (
    <nav className="hidden md:flex items-center gap-2 bg-white/10 rounded-full p-1">
      {navItems.map((item) => {
        const active = isActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-colors ${
              active
                ? "bg-white text-icc-violet"
                : "text-white/90 hover:bg-white/15 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
