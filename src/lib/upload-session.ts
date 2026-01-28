import { createId } from "@paralleldrive/cuid2"
import type { MediaType } from "@prisma/client"

function generateId(): string {
  return createId()
}

// ============================================
// TYPES
// ============================================

export interface UploadSession {
  id: string
  userId: string
  filename: string
  contentType: string
  size: number
  type: MediaType
  eventId?: string
  projectId?: string
  s3Key: string
  createdAt: Date
  expiresAt: Date
}

// ============================================
// IN-MEMORY SESSION STORE
// ============================================

const sessions = new Map<string, UploadSession>()

// Cleanup expired sessions every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000

let cleanupTimer: NodeJS.Timeout | null = null

function startCleanupTimer() {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    const now = new Date()
    for (const [id, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(id)
      }
    }
  }, CLEANUP_INTERVAL)

  // Don't prevent process from exiting
  cleanupTimer.unref()
}

// Start cleanup on module load
startCleanupTimer()

// ============================================
// SESSION MANAGEMENT
// ============================================

export function createUploadSession(params: {
  userId: string
  filename: string
  contentType: string
  size: number
  type: MediaType
  eventId?: string
  projectId?: string
  s3Key: string
  expirySeconds: number
}): UploadSession {
  const id = generateId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + params.expirySeconds * 1000)

  const session: UploadSession = {
    id,
    userId: params.userId,
    filename: params.filename,
    contentType: params.contentType,
    size: params.size,
    type: params.type,
    eventId: params.eventId,
    projectId: params.projectId,
    s3Key: params.s3Key,
    createdAt: now,
    expiresAt,
  }

  sessions.set(id, session)
  return session
}

export function getUploadSession(id: string): UploadSession | null {
  const session = sessions.get(id)

  if (!session) {
    return null
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    sessions.delete(id)
    return null
  }

  return session
}

export function deleteUploadSession(id: string): boolean {
  return sessions.delete(id)
}

export function getSessionsByUser(userId: string): UploadSession[] {
  const userSessions: UploadSession[] = []
  const now = new Date()

  for (const session of sessions.values()) {
    if (session.userId === userId && session.expiresAt >= now) {
      userSessions.push(session)
    }
  }

  return userSessions
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimits = new Map<string, { count: number; resetAt: Date }>()

const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 50 // 50 requests per hour

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = new Date()
  const key = `upload:${userId}`

  let limit = rateLimits.get(key)

  // Reset if window expired
  if (!limit || limit.resetAt < now) {
    limit = {
      count: 0,
      resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW),
    }
    rateLimits.set(key, limit)
  }

  const remaining = RATE_LIMIT_MAX - limit.count

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, resetAt: limit.resetAt }
  }

  // Increment count
  limit.count++

  return { allowed: true, remaining: remaining - 1, resetAt: limit.resetAt }
}
