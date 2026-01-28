import { z } from "zod"

// ============================================
// ENUMS
// ============================================

export const PhotoStatusEnum = z
  .enum(["PENDING", "APPROVED", "REJECTED"])
  .openapi("PhotoStatus")

// ============================================
// PHOTO SCHEMAS
// ============================================

export const PhotoSchema = z
  .object({
    id: z.string().cuid2(),
    filename: z.string(),
    thumbnailUrl: z.string().url(),
    status: PhotoStatusEnum,
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    uploadedAt: z.string().datetime(),
    validatedAt: z.string().datetime().nullable(),
  })
  .openapi("Photo")

export const PhotoWithOriginalUrlSchema = PhotoSchema.extend({
  originalUrl: z.string().url(),
}).openapi("PhotoWithOriginalUrl")

export const PhotoUrlResponseSchema = z
  .object({
    url: z.string().url(),
    expiresAt: z.string().datetime(),
    filename: z.string().optional(),
  })
  .openapi("PhotoUrlResponse")

// ============================================
// UPLOAD SCHEMAS
// ============================================

export const UploadResponseSchema = z
  .object({
    uploaded: z.array(
      z.object({
        id: z.string().cuid(),
        filename: z.string(),
        thumbnailUrl: z.string().url(),
      })
    ),
    errors: z.array(
      z.object({
        filename: z.string(),
        error: z.string(),
      })
    ),
  })
  .openapi("UploadResponse")

// ============================================
// TYPES
// ============================================

export type PhotoStatus = z.infer<typeof PhotoStatusEnum>
export type Photo = z.infer<typeof PhotoSchema>
export type PhotoWithOriginalUrl = z.infer<typeof PhotoWithOriginalUrlSchema>
export type PhotoUrlResponse = z.infer<typeof PhotoUrlResponseSchema>
export type UploadResponse = z.infer<typeof UploadResponseSchema>
