import { describe, it, expect } from "vitest";
import { sanitizeTextForPostgres, formatBytes } from "@/lib/utils";

describe("PostgreSQL Text Sanitization Utility", () => {
  it("strips null bytes (\\u0000 and \\0) that cause PostgreSQL 22P05 unsupported Unicode escape sequence error", () => {
    const dirtyText = "Capítulo 1\u0000: Bases de datos\0 y SQL";
    const cleaned = sanitizeTextForPostgres(dirtyText);
    expect(cleaned).toBe("Capítulo 1: Bases de datos y SQL");
    expect(cleaned).not.toContain("\u0000");
    expect(cleaned).not.toContain("\0");
  });

  it("preserves Spanish accents, symbols, newlines, and tabs", () => {
    const spanishText = "• Identificación de bases de datos relacionales.\n¿Qué modelo usar?\tPrecio: 1,75 €\r\n";
    const cleaned = sanitizeTextForPostgres(spanishText);
    expect(cleaned).toBe(spanishText);
  });

  it("preserves valid 4-byte Unicode characters (surrogate pairs) such as emojis", () => {
    const emojiText = "Study material 📚 — Databases & SQL 🚀";
    const cleaned = sanitizeTextForPostgres(emojiText);
    expect(cleaned).toBe(emojiText);
  });

  it("safely handles null and undefined values", () => {
    expect(sanitizeTextForPostgres(null)).toBeNull();
    expect(sanitizeTextForPostgres(undefined)).toBeUndefined();
    expect(sanitizeTextForPostgres("")).toBe("");
  });

  it("removes orphan surrogate characters while preserving valid pairs", () => {
    // Lone high surrogate without low surrogate
    const corruptText = "Test\uD800Text";
    const cleaned = sanitizeTextForPostgres(corruptText);
    expect(cleaned).toBe("TestText");
  });
});

describe("formatBytes Utility", () => {
  it("formats byte values into human-readable strings", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
    expect(formatBytes(52428800)).toBe("50 MB");
  });
});
