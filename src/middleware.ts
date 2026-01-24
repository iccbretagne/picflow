import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Note: Avoid importing NextAuth/Prisma in middleware to keep it edge-safe.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/users/:path*",
    "/settings/:path*",
  ],
}
