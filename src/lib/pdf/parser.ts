import pdfParse from "pdf-parse";
import { AppError } from "@/lib/errors";
import { sanitizeTextForPostgres } from "@/lib/utils";

export interface PageTextData {
  pageNumber: number;
  text: string;
}

export interface PdfParseResult {
  pageCount: number;
  info?: Record<string, unknown>;
  pages: PageTextData[];
  rawText: string;
}

export interface PdfParser {
  parse(buffer: Buffer): Promise<PdfParseResult>;
}

export class PdfParseParser implements PdfParser {
  public async parse(buffer: Buffer): Promise<PdfParseResult> {
    try {
      const pageTexts: PageTextData[] = [];

      // Custom page render callback to collect per-page text
      const options = {
        pagerender: (pageData: { pageIndex: number; getTextContent: (opts?: { normalizeWhitespace?: boolean }) => Promise<{ items: Array<{ str: string }> }> }) => {
          return pageData.getTextContent({ normalizeWhitespace: true }).then((textContent) => {
            let text = "";
            for (let i = 0; i < textContent.items.length; i++) {
              const item = textContent.items[i];
              const cleaned = sanitizeTextForPostgres(item.str);
              if (i === 0) {
                text += cleaned;
              } else {
                text += " " + cleaned;
              }
            }
            pageTexts.push({
              pageNumber: pageData.pageIndex + 1,
              text: sanitizeTextForPostgres(text).trim(),
            });
            return text;
          });
        },
      };

      const result = await pdfParse(buffer, options);

      return {
        pageCount: result.numpages || pageTexts.length || 1,
        info: result.info,
        pages: pageTexts.sort((a, b) => a.pageNumber - b.pageNumber),
        rawText: sanitizeTextForPostgres(result.text || ""),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("encrypted") || message.includes("password")) {
        throw new AppError("PDF file is password protected or encrypted", 422, "ENCRYPTED_PDF");
      }
      throw new AppError(`Failed to parse PDF document: ${message}`, 422, "MALFORMED_PDF");
    }
  }
}

export const defaultPdfParser = new PdfParseParser();
