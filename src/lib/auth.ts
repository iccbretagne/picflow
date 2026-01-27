import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import { ApiError } from "./api-utils"
import {
  type Permission,
  type Role,
  hasPermission,
  hasAnyPermission,
  getPermissions,
} from "./permissions"

// ============================================
// NEXTAUTH CONFIGURATION
// ============================================

// Super admin emails from env
const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS?.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean) || []

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Auto-approve super admins
      if (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })

        if (existingUser) {
          // Update existing super admin to ACTIVE if not already
          if (existingUser.status !== "ACTIVE") {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { status: "ACTIVE", role: "ADMIN" },
            })
          }
        }
        // For new users, the adapter will create them as PENDING,
        // but we'll update them in the session callback
      }
      return true
    },
    async session({ session, user }) {
      // Add user id, role, and status to session
      if (session.user) {
        session.user.id = user.id

        // Check if user is a super admin and auto-activate
        const isSuperAdmin = session.user.email &&
          SUPER_ADMIN_EMAILS.includes(session.user.email.toLowerCase())

        // Fetch user role and status
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, status: true },
        })

        // Auto-activate super admins
        if (isSuperAdmin && dbUser?.status !== "ACTIVE") {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: "ACTIVE", role: "ADMIN" },
          })
          session.user.role = "ADMIN"
          session.user.status = "ACTIVE"
        } else {
          session.user.role = dbUser?.role || "ADMIN"
          session.user.status = dbUser?.status || "PENDING"
        }

        // Add permissions to session
        session.user.permissions = getPermissions(session.user.role as Role)
      }
      return session
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  trustHost: true,
})

// ============================================
// AUTH HELPERS
// ============================================

export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED")
  }

  if (session.user.status !== "ACTIVE") {
    if (session.user.status === "PENDING") {
      throw new ApiError(
        403,
        "Votre compte est en attente d'approbation par un administrateur",
        "PENDING_APPROVAL"
      )
    } else if (session.user.status === "REJECTED") {
      throw new ApiError(
        403,
        "Votre compte a été rejeté. Veuillez contacter un administrateur",
        "ACCESS_DENIED"
      )
    }
  }

  return session.user
}

export async function requireAdmin() {
  const user = await requireAuth()

  if (user.role !== "ADMIN") {
    throw new ApiError(403, "Admin access required", "FORBIDDEN")
  }

  return user
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth()

  if (!hasPermission(user.role as Role, permission)) {
    throw new ApiError(403, `Permission required: ${permission}`, "FORBIDDEN")
  }

  return user
}

export async function requireAnyPermission(permissions: Permission[]) {
  const user = await requireAuth()

  if (!hasAnyPermission(user.role as Role, permissions)) {
    throw new ApiError(403, `One of these permissions required: ${permissions.join(", ")}`, "FORBIDDEN")
  }

  return user
}

// ============================================
// TYPE AUGMENTATION
// ============================================

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: "ADMIN" | "MEDIA"
      status: "PENDING" | "ACTIVE" | "REJECTED"
      permissions: Permission[]
    }
  }

  interface User {
    role?: "ADMIN" | "MEDIA"
    status?: "PENDING" | "ACTIVE" | "REJECTED"
  }
}

// Re-export permissions types and helpers for convenience
export type { Permission, Role }
export { hasPermission, hasAnyPermission, getPermissions }
