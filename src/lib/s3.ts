import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// ============================================
// S3 CLIENT (OVH Object Storage)
// ============================================

const s3Client = new S3Client({
  region: process.env.S3_REGION || "gra",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for OVH
})

const BUCKET = process.env.S3_BUCKET!

// ============================================
// URL EXPIRY TIMES
// ============================================

const THUMBNAIL_URL_EXPIRY = 3600 // 1 hour
const ORIGINAL_URL_EXPIRY = 300 // 5 minutes
const DOWNLOAD_URL_EXPIRY = 600 // 10 minutes
const LOGO_URL_EXPIRY = 86400 // 24 hours

// ============================================
// KEY GENERATION
// ============================================

export function getOriginalKey(eventId: string, photoId: string, extension: string) {
  return `events/${eventId}/originals/${photoId}.${extension}`
}

export function getThumbnailKey(eventId: string, photoId: string) {
  return `events/${eventId}/thumbnails/${photoId}.webp`
}

export function getZipKey(eventId: string, jobId: string) {
  return `events/${eventId}/zips/${jobId}.zip`
}

export function getLogoKey(variant: "original" | "header" | "login"): string {
  return `settings/logo-${variant}.png`
}

export function getFaviconKey(
  variant: "original" | "ico" | "png192" | "png512"
): string {
  if (variant === "ico") return "settings/favicon.ico"
  return `settings/favicon-${variant}.png`
}

// ============================================
// MEDIA EXTENSION KEYS
// ============================================

export type ContainerType = "events" | "projects"

export function getMediaOriginalKey(
  containerType: ContainerType,
  containerId: string,
  mediaId: string,
  extension: string
): string {
  return `${containerType}/${containerId}/media/originals/${mediaId}.${extension}`
}

export function getMediaThumbnailKey(
  containerType: ContainerType,
  containerId: string,
  mediaId: string
): string {
  return `${containerType}/${containerId}/media/thumbnails/${mediaId}.webp`
}

export function getVersionOriginalKey(
  mediaId: string,
  versionNumber: number,
  extension: string
): string {
  return `versions/${mediaId}/v${versionNumber}/${mediaId}.${extension}`
}

export function getVersionThumbnailKey(
  mediaId: string,
  versionNumber: number
): string {
  return `versions/${mediaId}/v${versionNumber}/${mediaId}.webp`
}

export function getQuarantineKey(uploadId: string, extension: string): string {
  return `quarantine/${uploadId}.${extension}`
}

// ============================================
// UPLOAD
// ============================================

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await s3Client.send(command)
}

// ============================================
// SIGNED URLS
// ============================================

export async function getSignedThumbnailUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: THUMBNAIL_URL_EXPIRY })
}

export async function getSignedOriginalUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: ORIGINAL_URL_EXPIRY })
}

export async function getSignedDownloadUrl(
  key: string,
  filename: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  })
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_URL_EXPIRY })
}

export async function getSignedLogoUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: LOGO_URL_EXPIRY })
}

// ============================================
// PRESIGNED PUT URL (for direct uploads)
// ============================================

export async function getSignedPutUrl(
  key: string,
  contentType: string,
  maxSize: number,
  expiresIn: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders: new Set(["content-type"]),
  })
}

// ============================================
// FILE OPERATIONS
// ============================================

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

export async function getFileHead(
  key: string
): Promise<{ size: number; contentType: string } | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    )
    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? "application/octet-stream",
    }
  } catch {
    return null
  }
}

export async function getFileBytes(
  key: string,
  start: number,
  end: number
): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Range: `bytes=${start}-${end}`,
      })
    )

    if (!response.Body) {
      return null
    }

    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

export async function moveFile(sourceKey: string, destinationKey: string): Promise<void> {
  // Copy to new location
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destinationKey,
    })
  )

  // Delete original
  await deleteFile(sourceKey)
}

// ============================================
// DELETE
// ============================================

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  await s3Client.send(command)
}

export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteFile(key)))
}

// ============================================
// EXPORT CLIENT (for advanced usage)
// ============================================

export { s3Client, BUCKET }
