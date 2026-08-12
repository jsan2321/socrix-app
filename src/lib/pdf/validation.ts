import crypto from "crypto";
import { config } from "@/lib/config";
import {
  ValidationError,
  PayloadTooLargeError,
  UnprocessableEntityError,
} from "@/lib/errors";

export interface PdfValidationResult {
  contentHash: string;
  fileSizeBytes: number;
}

/**
 * Validates PDF binary stream/buffer against SRS §4.1 FR-ING-1 & FR-ING-6.
 * Checks MIME type, magic bytes (%PDF-), file size (≤50MB), SHA-256 hash, and scanned PDF threshold.
 */
export function validatePdfFile(
  fileBuffer: Buffer,
  mimeType?: string
): PdfValidationResult {
  // 1. MIME type validation
  if (mimeType && mimeType !== "application/pdf" && !mimeType.includes("pdf")) {
    throw new ValidationError("Uploaded file must be a PDF document (Content-Type: application/pdf)");
  }

  // 2. File size validation
  const maxBytes = config.MAX_UPLOAD_MB * 1024 * 1024;
  if (fileBuffer.length > maxBytes) {
    throw new PayloadTooLargeError(
      `PDF file size (${(fileBuffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${config.MAX_UPLOAD_MB} MB`
    );
  }

  // 3. Magic Bytes check (%PDF- header: 0x25 0x50 0x44 0x46 0x2D)
  if (fileBuffer.length < 5) {
    throw new ValidationError("Uploaded file is too small to be a valid PDF");
  }

  const magicHeader = fileBuffer.subarray(0, 5).toString("ascii");
  if (magicHeader !== "%PDF-") {
    throw new ValidationError("Invalid PDF file format (magic bytes header check failed)");
  }

  // 4. SHA-256 Hash calculation for duplicate detection
  const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  return {
    contentHash,
    fileSizeBytes: fileBuffer.length,
  };
}

/**
 * Validates extracted text character density to detect scanned/image-only PDFs.
 * Heuristic: average < 50 characters per page -> likely_scanned.
 */
export function validateScannedPdfThreshold(
  totalCharacters: number,
  pageCount: number
): void {
  if (pageCount <= 0) return;
  const avgCharsPerPage = totalCharacters / pageCount;

  if (totalCharacters < 200 || avgCharsPerPage < 50) {
    throw new UnprocessableEntityError(
      "PDF appears to be scanned or contains no extractable text. OCR is not supported in this version.",
      { failureReason: "likely_scanned" }
    );
  }
}
