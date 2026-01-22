import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

extendZodWithOpenApi(z)

// ============================================
// APP SETTINGS
// ============================================

export const AppSettingsSchema = z
  .object({
    id: z.string().default("default"),
    logoKey: z.string().nullable(),
    faviconKey: z.string().nullable(),
    logoFilename: z.string().nullable(),
    faviconFilename: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("AppSettings")

export const AppSettingsResponseSchema = z
  .object({
    hasLogo: z.boolean(),
    hasFavicon: z.boolean(),
    logoUrl: z.string().url().nullable(),
    faviconUrl: z.string().url().nullable(),
  })
  .openapi("AppSettingsResponse")

// File upload validation
export const LOGO_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
export const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"]

export type AppSettings = z.infer<typeof AppSettingsSchema>
export type AppSettingsResponse = z.infer<typeof AppSettingsResponseSchema>
