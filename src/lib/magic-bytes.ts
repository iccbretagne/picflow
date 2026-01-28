// ============================================
// MAGIC BYTES SIGNATURES
// ============================================

// File type signatures (magic bytes)
// Reference: https://en.wikipedia.org/wiki/List_of_file_signatures

interface MagicSignature {
  bytes: number[]
  offset?: number
  mask?: number[]
}

interface FileTypeDefinition {
  mimeType: string
  signatures: MagicSignature[]
}

const FILE_SIGNATURES: FileTypeDefinition[] = [
  // Images
  {
    mimeType: "image/jpeg",
    signatures: [{ bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mimeType: "image/png",
    signatures: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mimeType: "image/webp",
    signatures: [
      {
        bytes: [0x52, 0x49, 0x46, 0x46], // RIFF
        // Followed by 4 bytes file size, then WEBP
      },
    ],
  },
  {
    mimeType: "image/gif",
    signatures: [
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  {
    mimeType: "image/svg+xml",
    signatures: [
      { bytes: [0x3c, 0x73, 0x76, 0x67] }, // <svg
      { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] }, // <?xml (SVG often starts with XML declaration)
    ],
  },
  {
    mimeType: "image/heic",
    signatures: [
      { bytes: [0x00, 0x00, 0x00], offset: 0 }, // ftyp box
    ],
  },
  {
    mimeType: "image/heif",
    signatures: [
      { bytes: [0x00, 0x00, 0x00], offset: 0 }, // ftyp box
    ],
  },

  // PDF
  {
    mimeType: "application/pdf",
    signatures: [{ bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // %PDF-
  },

  // Videos
  {
    mimeType: "video/mp4",
    signatures: [
      { bytes: [0x00, 0x00, 0x00], offset: 0 }, // ftyp box (shared with HEIC)
    ],
  },
  {
    mimeType: "video/quicktime",
    signatures: [
      { bytes: [0x00, 0x00, 0x00], offset: 0 }, // ftyp box
    ],
  },
  {
    mimeType: "video/webm",
    signatures: [{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }], // EBML header
  },
]

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Check if a buffer matches a magic signature
 */
function matchesSignature(buffer: Uint8Array, signature: MagicSignature): boolean {
  const offset = signature.offset ?? 0

  if (buffer.length < offset + signature.bytes.length) {
    return false
  }

  for (let i = 0; i < signature.bytes.length; i++) {
    const bufferByte = buffer[offset + i]
    const signatureByte = signature.bytes[i]
    const maskByte = signature.mask?.[i] ?? 0xff

    if ((bufferByte & maskByte) !== (signatureByte & maskByte)) {
      return false
    }
  }

  return true
}

/**
 * Detect file type from buffer (first 512 bytes recommended)
 */
export function detectFileType(buffer: Uint8Array): string | null {
  for (const fileDef of FILE_SIGNATURES) {
    for (const signature of fileDef.signatures) {
      if (matchesSignature(buffer, signature)) {
        return fileDef.mimeType
      }
    }
  }

  return null
}

/**
 * Validate that buffer matches expected MIME type
 */
export function validateMagicBytes(
  buffer: Uint8Array,
  expectedMimeType: string
): { valid: boolean; detectedType: string | null } {
  const detectedType = detectFileType(buffer)

  // Special handling for container formats (MP4, MOV, HEIC share ftyp box)
  const containerFormats = ["video/mp4", "video/quicktime", "image/heic", "image/heif"]
  if (containerFormats.includes(expectedMimeType)) {
    // Check for ftyp box signature
    if (buffer.length >= 12) {
      const ftypSignature = [0x66, 0x74, 0x79, 0x70] // "ftyp"
      const hasFtyp =
        buffer[4] === ftypSignature[0] &&
        buffer[5] === ftypSignature[1] &&
        buffer[6] === ftypSignature[2] &&
        buffer[7] === ftypSignature[3]

      if (hasFtyp) {
        // Check brand for more specific type
        const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11])

        // MP4 brands
        if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(brand)) {
          return {
            valid: expectedMimeType === "video/mp4",
            detectedType: "video/mp4",
          }
        }

        // QuickTime brands
        if (["qt  ", "moov"].includes(brand)) {
          return {
            valid: expectedMimeType === "video/quicktime",
            detectedType: "video/quicktime",
          }
        }

        // HEIC/HEIF brands
        if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
          return {
            valid: expectedMimeType === "image/heic" || expectedMimeType === "image/heif",
            detectedType: "image/heic",
          }
        }

        // Accept generic ftyp for video types
        if (expectedMimeType === "video/mp4" || expectedMimeType === "video/quicktime") {
          return { valid: true, detectedType: expectedMimeType }
        }
      }
    }
  }

  // WebP special handling (check for WEBP after RIFF)
  if (expectedMimeType === "image/webp" && buffer.length >= 12) {
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50

    if (isRiff && isWebp) {
      return { valid: true, detectedType: "image/webp" }
    }
  }

  // SVG can be detected by looking for <svg or <?xml
  if (expectedMimeType === "image/svg+xml") {
    const text = new TextDecoder().decode(buffer.slice(0, 100))
    if (text.includes("<svg") || (text.includes("<?xml") && text.includes("svg"))) {
      return { valid: true, detectedType: "image/svg+xml" }
    }
  }

  // Direct match
  if (detectedType === expectedMimeType) {
    return { valid: true, detectedType }
  }

  // No match found
  return { valid: false, detectedType }
}
