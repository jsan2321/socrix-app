import { describe, it, expect } from "vitest";
import { validatePdfFile, validateScannedPdfThreshold } from "@/lib/pdf/validation";
import { ValidationError, PayloadTooLargeError, UnprocessableEntityError } from "@/lib/errors";

describe("PDF Validation Pipeline", () => {
  it("should validate a valid PDF binary buffer", () => {
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

  it("should accept a buffer at the exact boundary of 50 MB", () => {
    // Exact 50 MB = 50 * 1024 * 1024 bytes
    const exact50MbBuffer = Buffer.alloc(50 * 1024 * 1024);
    exact50MbBuffer.write("%PDF-");
    const result = validatePdfFile(exact50MbBuffer, "application/pdf");
    expect(result.fileSizeBytes).toBe(50 * 1024 * 1024);
  });

  it("should reject an oversized buffer exceeding 50 MB by exactly 1 byte", () => {
    const oversizedBuffer = Buffer.alloc(50 * 1024 * 1024 + 1);
    oversizedBuffer.write("%PDF-");
    expect(() => validatePdfFile(oversizedBuffer, "application/pdf")).toThrow(PayloadTooLargeError);
  });

  it("should reject empty buffer (0 bytes)", () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(() => validatePdfFile(emptyBuffer, "application/pdf")).toThrow(ValidationError);
  });

  it("should reject buffers shorter than 5 bytes", () => {
    const shortBuffer = Buffer.from("%PD");
    expect(() => validatePdfFile(shortBuffer, "application/pdf")).toThrow(ValidationError);
  });

  it("should detect scanned/image-only PDF density below threshold", () => {
    // 100 characters total across 10 pages = 10 chars/page (< 50 threshold)
    expect(() => validateScannedPdfThreshold(100, 10)).toThrow(UnprocessableEntityError);
  });

  it("should reject when total characters is below minimum baseline (200 chars)", () => {
    // 150 characters on 1 page: avg is 150 (>= 50), but total < 200
    expect(() => validateScannedPdfThreshold(150, 1)).toThrow(UnprocessableEntityError);
  });

  it("should pass scanned check for text-dense PDF meeting both threshold invariants", () => {
    // 5000 characters across 5 pages = 1000 chars/page (> 50 and > 200)
    expect(() => validateScannedPdfThreshold(5000, 5)).not.toThrow();
  });

  it("should produce deterministic SHA-256 content hashes for identical files", () => {
    const bufA = Buffer.from("%PDF-1.4\nIdentical stream content\n%%EOF");
    const bufB = Buffer.from("%PDF-1.4\nIdentical stream content\n%%EOF");

    const resA = validatePdfFile(bufA, "application/pdf");
    const resB = validatePdfFile(bufB, "application/pdf");

    expect(resA.contentHash).toBe(resB.contentHash);
  });
});
