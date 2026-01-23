import { randomBytes } from "crypto"
import { prisma } from "./prisma"
import { ApiError } from "./api-utils"
import type { TokenType } from "@prisma/client"

// ============================================
// TOKEN GENERATION
// ============================================

export function generateToken(): string {
  return randomBytes(32).toString("hex") // 64 characters
}

// ============================================
// TOKEN VALIDATION
// ============================================

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return new Date() > expiresAt
}

// ============================================
// SHARE TOKEN VALIDATION
// ============================================

export async function validateShareToken(
  token: string,
  requiredType?: TokenType
) {
  const shareToken = await prisma.shareToken.findUnique({
    where: { token },
    include: {
      event: {
        include: {
          photos: true,
          church: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!shareToken) {
    throw new ApiError(401, "Invalid token", "INVALID_TOKEN")
  }

  if (isTokenExpired(shareToken.expiresAt)) {
    throw new ApiError(401, "Token has expired", "TOKEN_EXPIRED")
  }

  if (requiredType && shareToken.type !== requiredType) {
    throw new ApiError(
      403,
      `This operation requires a ${requiredType} token`,
      "WRONG_TOKEN_TYPE"
    )
  }

  // Update usage stats
  await prisma.shareToken.update({
    where: { id: shareToken.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return shareToken
}

// ============================================
// CREATE SHARE TOKEN
// ============================================

export async function createShareToken(
  eventId: string,
  type: TokenType,
  label?: string,
  expiresInDays?: number
) {
  const token = generateToken()
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const shareToken = await prisma.shareToken.create({
    data: {
      token,
      type,
      label,
      expiresAt,
      eventId,
    },
  })

  const baseUrl = process.env.APP_URL || "http://localhost:3000"
  const urlPath = type === "VALIDATOR" ? "v" : "d"

  return {
    ...shareToken,
    url: `${baseUrl}/${urlPath}/${token}`,
  }
}
