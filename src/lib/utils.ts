import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a string for PostgreSQL text and JSON storage.
 * PostgreSQL strictly forbids null bytes (\u0000 / \0) in text and json fields
 * (SQLSTATE 22P05: unsupported Unicode escape sequence).
 * Also strips unmatched UTF-16 surrogate codepoints while preserving valid newlines,
 * tabs, Spanish accents, and Unicode characters.
 */
export function sanitizeTextForPostgres(text: string): string;
export function sanitizeTextForPostgres(text: string | null): string | null;
export function sanitizeTextForPostgres(text: string | undefined): string | undefined;
export function sanitizeTextForPostgres(text: string | null | undefined): string | null | undefined {
  if (text == null) return text;
  return text
    .replace(/\u0000/g, "")
    .replace(/\0/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

/**
 * Formats byte values into human-readable strings (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
