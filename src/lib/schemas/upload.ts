import { z } from "zod"
import { MediaTypeEnum, VISUAL_MIME_TYPES, VIDEO_MIME_TYPES } from "./media"

// ============================================
// CONSTANTS
// ============================================

export const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB
export const MAX_VISUAL_SIZE = 50 * 1024 * 1024 // 50 MB
export const PRESIGNED_URL_EXPIRY = 15 * 60 // 15 minutes in seconds

// ============================================
// REQUEST PRESIGNED URL
// ============================================

export const RequestPresignedUrlSchema = z
  .object({
    filename: z.string().min(1).max(255).openapi({ example: "video-intro.mp4" }),
    contentType: z.string().min(1).max(100).openapi({ example: "video/mp4" }),
    size: z
      .number()
      .int()
      .min(1)
      .max(MAX_FILE_SIZE)
      .openapi({ example: 104857600, description: "File size in bytes (max 500 MB)" }),
    type: MediaTypeEnum.openapi({ example: "VIDEO" }),
    eventId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
  })
  .refine((data) => Boolean(data.eventId) !== Boolean(data.projectId), {
    message: "Exactly one of eventId or projectId must be provided",
  })
  .refine(
    (data) => {
      // Validate content type matches media type
      if (data.type === "VISUAL") {
        return VISUAL_MIME_TYPES.includes(data.contentType as typeof VISUAL_MIME_TYPES[number])
      }
      if (data.type === "VIDEO") {
        return VIDEO_MIME_TYPES.includes(data.contentType as typeof VIDEO_MIME_TYPES[number])
      }
      return false // PHOTO type should use direct upload
    },
    {
      message: "Content type does not match the specified media type",
    }
  )
  .openapi("RequestPresignedUrlRequest")

export const PresignedUrlResponseSchema = z
  .object({
    uploadId: z.string().cuid(),
    url: z.string().url(),
    expiresAt: z.string().datetime(),
  })
  .openapi("PresignedUrlResponse")

// ============================================
// CONFIRM UPLOAD
// ============================================

export const ConfirmUploadSchema = z
  .object({
    uploadId: z.string().cuid(),
    thumbnailDataUrl: z
      .string()
      .optional()
      .openapi({
        description: "Base64 data URL for video thumbnail (extracted client-side)",
        example: "data:image/webp;base64,...",
      }),
  })
  .openapi("ConfirmUploadRequest")

export const ConfirmUploadResponseSchema = z
  .object({
    id: z.string().cuid(),
    type: MediaTypeEnum,
    filename: z.string(),
    thumbnailUrl: z.string().url(),
  })
  .openapi("ConfirmUploadResponse")

// ============================================
// TYPES
// ============================================

export type RequestPresignedUrl = z.infer<typeof RequestPresignedUrlSchema>
export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>
export type ConfirmUpload = z.infer<typeof ConfirmUploadSchema>
export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponseSchema>
