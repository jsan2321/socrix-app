import { describe, it, expect } from "vitest";
import { validatePdfFile, validateScannedPdfThreshold } from "@/lib/pdf/validation";
import { ValidationError, PayloadTooLargeError, UnprocessableEntityError } from "@/lib/errors";

describe("PDF Validation Pipeline", () => {
  it("should validate a valid PDF binary buffer", () => {
    // Valid %PDF- magic header
    const validPdfBuffer = Buffer.from("%PDF-1.7\nSample PDF Content Stream\n%%EOF");
    const result = validatePdfFile(validPdfBuffer, "application/pdf");

    expect(result.contentHash).toHaveLength(64); // SHA-256 hex string
    expect(result.fileSizeBytes).toBe(validPdfBuffer.length);
  });

  it("should reject non-PDF MIME type", () => {
    const validPdfBuffer = Buffer.from("%PDF-1.7\nContent");
    expect(() => validatePdfFile(validPdfBuffer, "image/png")).toThrow(ValidationError);
  });

  it("should reject invalid magic bytes header", () => {
    const invalidHeaderBuffer = Buffer.from("NOT_A_PDF_HEADER");
    expect(() => validatePdfFile(invalidHeaderBuffer, "application/pdf")).toThrow(ValidationError);
  });

  it("should reject oversized PDF buffer (>50 MB)", () => {
    // Create oversized mock length check
    const mockOversizedBuffer = Buffer.alloc(51 * 1024 * 1024);
    // Write valid %PDF- magic header at start
    mockOversizedBuffer.write("%PDF-");
    expect(() => validatePdfFile(mockOversizedBuffer, "application/pdf")).toThrow(PayloadTooLargeError);
  });

  it("should detect scanned/image-only PDF density below threshold", () => {
    // 100 characters total across 10 pages = 10 chars/page (< 50 threshold)
    expect(() => validateScannedPdfThreshold(100, 10)).toThrow(UnprocessableEntityError);
  });

  it("should pass scanned check for normal text-dense PDF", () => {
    // 5000 characters across 5 pages = 1000 chars/page (well above 50 threshold)
    expect(() => validateScannedPdfThreshold(5000, 5)).not.toThrow();
  });
});
