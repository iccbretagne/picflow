import { z } from "zod"
import { PhotoSchema } from "./photo"

// ============================================
// VALIDATION EVENT RESPONSE
// ============================================

export const ValidationEventResponseSchema = z
  .object({
    event: z.object({
      id: z.string().cuid(),
      name: z.string(),
      date: z.string().datetime(),
      church: z.string(),
    }),
    photos: z.array(PhotoSchema),
    stats: z.object({
      total: z.number().int(),
      pending: z.number().int(),
      approved: z.number().int(),
      rejected: z.number().int(),
    }),
  })
  .openapi("ValidationEventResponse")

// ============================================
// SUBMIT VALIDATION
// ============================================

export const SubmitValidationSchema = z
  .object({
    decisions: z
      .array(
        z.object({
          photoId: z.string().cuid2(),
          status: z.enum(["APPROVED", "REJECTED"]),
        })
      )
      .min(1),
  })
  .openapi("SubmitValidationRequest")

export const ValidationResultSchema = z
  .object({
    updated: z.number().int(),
    stats: z.object({
      total: z.number().int(),
      approved: z.number().int(),
      rejected: z.number().int(),
    }),
  })
  .openapi("ValidationResult")

// ============================================
// DOWNLOAD / ZIP
// ============================================

export const DownloadEventResponseSchema = z
  .object({
    event: z.object({
      id: z.string().cuid(),
      name: z.string(),
      date: z.string().datetime(),
      church: z.string(),
    }),
    photos: z.array(PhotoSchema),
  })
  .openapi("DownloadEventResponse")

export const CreateZipRequestSchema = z
  .object({
    photoIds: z.array(z.string().cuid2()).optional(),
  })
  .openapi("CreateZipRequest")

export const ZipJobResponseSchema = z
  .object({
    jobId: z.string().cuid(),
    statusUrl: z.string().url(),
  })
  .openapi("ZipJobResponse")

export const ZipStatusEnum = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"])

export const ZipStatusResponseSchema = z
  .object({
    status: ZipStatusEnum,
    progress: z.number().int().min(0).max(100).optional(),
    downloadUrl: z.string().url().optional(),
    expiresAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .openapi("ZipStatusResponse")

// ============================================
// TYPES
// ============================================

export type ValidationEventResponse = z.infer<typeof ValidationEventResponseSchema>
export type SubmitValidation = z.infer<typeof SubmitValidationSchema>
export type ValidationResult = z.infer<typeof ValidationResultSchema>
export type DownloadEventResponse = z.infer<typeof DownloadEventResponseSchema>
export type CreateZipRequest = z.infer<typeof CreateZipRequestSchema>
export type ZipJobResponse = z.infer<typeof ZipJobResponseSchema>
export type ZipStatus = z.infer<typeof ZipStatusEnum>
export type ZipStatusResponse = z.infer<typeof ZipStatusResponseSchema>
