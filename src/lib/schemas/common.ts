import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

extendZodWithOpenApi(z)

// ============================================
// PAGINATION
// ============================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
})

export const PaginationSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pages: z.number().int(),
})

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  })
}

// ============================================
// ERROR
// ============================================

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional(),
    }),
  })
  .openapi("Error")

// ============================================
// PARAMS
// ============================================

export const IdParamSchema = z.object({
  id: z.string().cuid().openapi({ example: "clx1234567890abcdef" }),
})

export const TokenParamSchema = z.object({
  token: z.string().length(64).openapi({ example: "a1b2c3d4e5f6..." }),
})

// ============================================
// TYPES
// ============================================

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type Pagination = z.infer<typeof PaginationSchema>
export type ApiError = z.infer<typeof ErrorSchema>
