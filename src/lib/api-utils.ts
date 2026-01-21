import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// ============================================
// API ERROR CLASS
// ============================================

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

export async function validateBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      throw new ApiError(400, "Validation error", "VALIDATION_ERROR", result.error.flatten())
    }

    return result.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, "Invalid JSON body", "INVALID_JSON")
  }
}

export function validateQuery<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  const searchParams = new URL(request.url).searchParams
  const data = Object.fromEntries(searchParams.entries())
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new ApiError(400, "Invalid query parameters", "VALIDATION_ERROR", result.error.flatten())
  }

  return result.data
}

export function validateParams<T extends z.ZodTypeAny>(
  params: Record<string, string | string[]>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params)

  if (!result.success) {
    throw new ApiError(400, "Invalid path parameters", "VALIDATION_ERROR", result.error.flatten())
  }

  return result.data
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Standard API response format:
 * - Success: { data: T }
 * - Error: { error: { code, message, details? } }
 *
 * For paginated responses, use paginatedResponse() instead.
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ data }, { status })
}

/**
 * Paginated response format:
 * { data: T[], pagination: { total, page, limit, pages } }
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  status: number = 200
) {
  return NextResponse.json(
    {
      data: items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
    { status }
  )
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    )
  }

  console.error("Unhandled error:", error)

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  )
}

// ============================================
// PAGINATION HELPERS
// ============================================

export function getPaginationParams(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  }
}
