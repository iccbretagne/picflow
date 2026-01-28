import sharp from "sharp"
import pngToIco from "png-to-ico"

// ============================================
// IMAGE PROCESSING RESULT
// ============================================

export interface ProcessedImage {
  original: Buffer
  thumbnail: Buffer
  metadata: {
    width: number
    height: number
    format: string
  }
}

// ============================================
// ALLOWED MIME TYPES
// ============================================

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ============================================
// IMAGE PROCESSING
// ============================================

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error("Could not read image metadata")
  }

  // Original: preserve with EXIF rotation applied
  const original = await image
    .rotate() // Auto-rotation based on EXIF
    .jpeg({ quality: 90 })
    .toBuffer()

  // Thumbnail: 400px wide, WebP format
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return {
    original,
    thumbnail,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
  }
}

// ============================================
// LOGO PROCESSING
// ============================================

export interface ProcessedLogo {
  original: Buffer
  header: Buffer // 200px height for admin header
  login: Buffer // 300px height for login page
}

export async function processLogo(buffer: Buffer): Promise<ProcessedLogo> {
  const image = sharp(buffer)

  // Header logo: 200px height, maintain aspect ratio
  const header = await image
    .clone()
    .resize(null, 200, { withoutEnlargement: true, fit: "inside" })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()

  // Login logo: 300px height, maintain aspect ratio
  const login = await image
    .clone()
    .resize(null, 300, { withoutEnlargement: true, fit: "inside" })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()

  // Original: preserve as-is for future re-processing
  const original = await image.png({ quality: 100 }).toBuffer()

  return { header, login, original }
}

// ============================================
// FAVICON PROCESSING
// ============================================

export interface ProcessedFavicon {
  ico: Buffer // Multi-size .ico (16x16, 32x32)
  png192: Buffer // 192x192 for PWA manifest
  png512: Buffer // 512x512 for PWA manifest
  original: Buffer
}

export async function processFavicon(buffer: Buffer): Promise<ProcessedFavicon> {
  const image = sharp(buffer)

  // For .ico, we need 16x16 and 32x32 PNGs
  const icon16 = await image.clone().resize(16, 16).png().toBuffer()
  const icon32 = await image.clone().resize(32, 32).png().toBuffer()

  // Generate .ico from PNGs using png-to-ico
  const ico = await pngToIco([icon16, icon32])

  // PWA manifest icons
  const png192 = await image.clone().resize(192, 192).png().toBuffer()
  const png512 = await image.clone().resize(512, 512).png().toBuffer()

  const original = await image.png({ quality: 100 }).toBuffer()

  return { ico, png192, png512, original }
}

// ============================================
// VALIDATION
// ============================================

export function validateFile(
  filename: string,
  mimeType: string,
  size: number
): void {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${Math.round(size / 1024 / 1024)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
    )
  }
}

// ============================================
// GET EXTENSION FROM MIME TYPE
// ============================================

export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  }
  return extensions[mimeType] || "jpg"
}

// ============================================
// THUMBNAIL GENERATION (for media extension)
// ============================================

export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotation based on EXIF
    .resize(400, 300, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer()
}
