import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/documents/route";
import * as docDb from "@/lib/db/documents";
import * as chunkDb from "@/lib/db/chunks";
import * as embeddingService from "@/lib/ai/embeddings";
import { defaultPdfParser } from "@/lib/pdf/parser";

const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440010";

vi.mock("@/lib/db/documents");
vi.mock("@/lib/db/chunks");
vi.mock("@/lib/ai/embeddings");
vi.mock("@/lib/pdf/parser");

vi.mock("@/lib/db/client", () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

function createMockRequestWithFile(fileBuffer: Buffer, fileName = "textbook.pdf", title?: string): Request {
  const arrayBuf = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  const mockFile = {
    name: fileName,
    type: "application/pdf",
    size: fileBuffer.length,
    arrayBuffer: async () => arrayBuf,
  };

  const mockFormData = {
    get: (key: string) => {
      if (key === "file") return mockFile;
      if (key === "title") return title ?? null;
      return null;
    },
  };

  const req = new Request("http://localhost:3000/api/documents", {
    method: "POST",
  });
  req.formData = async () => mockFormData as unknown as FormData;
  return req;
}

describe("Integration: Ingestion Pipeline (POST /api/documents)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes valid PDF upload end-to-end to 'ready' status", async () => {
    // 1. Mock duplicate check: not existing
    vi.spyOn(docDb, "getReadyDocumentByHash").mockResolvedValue(null);

    // 2. Mock create document
    vi.spyOn(docDb, "createDocument").mockResolvedValue({
      id: MOCK_DOC_ID,
      title: "Biology Textbook",
      content_hash: "mockhash123",
      status: "processing",
      failure_reason: null,
      page_count: null,
      chunks_total: null,
      chunks_embedded_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Mock parser output (rich pages with text exceeding minimum character threshold)
    const pageText =
      "Section 1: Cellular Bioenergetics.\n" +
      "Active cellular transport requires ATP hydrolysis to move ions across membranes.\n".repeat(8);

    vi.spyOn(defaultPdfParser, "parse").mockResolvedValue({
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: pageText },
        { pageNumber: 2, text: pageText },
      ],
      rawText: pageText + "\n" + pageText,
    });

    // 4. Mock embeddings generator returning 1536-dim vector
    const mockVector = new Array(1536).fill(0.05);
    vi.spyOn(embeddingService, "generateEmbeddings").mockResolvedValue([mockVector]);

    // 5. Mock chunk insertion and status update
    const mockDocRow = {
      id: MOCK_DOC_ID,
      title: "Biology Textbook",
      content_hash: "mockhash123",
      status: "ready" as const,
      failure_reason: null,
      page_count: 2,
      chunks_total: 1,
      chunks_embedded_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.spyOn(chunkDb, "insertDocumentChunks").mockResolvedValue([]);
    vi.spyOn(docDb, "incrementChunksEmbeddedCount").mockResolvedValue(mockDocRow);
    vi.spyOn(docDb, "updateDocumentStatus").mockResolvedValue(mockDocRow);

    const validPdfBuffer = Buffer.from("%PDF-1.4\nAcademic PDF Stream\n%%EOF");
    const req = createMockRequestWithFile(validPdfBuffer, "textbook.pdf", "Biology Textbook");

    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.documentId).toBe(MOCK_DOC_ID);
    expect(json.status).toBe("ready");
    expect(json.pageCount).toBe(2);
    expect(docDb.updateDocumentStatus).toHaveBeenCalledWith(MOCK_DOC_ID, "ready");
    expect(chunkDb.insertDocumentChunks).toHaveBeenCalled();
  });

  it("detects duplicate documents and returns 409 with existing document ID", async () => {
    vi.spyOn(docDb, "getReadyDocumentByHash").mockResolvedValue({
      id: "existing-doc-uuid",
      title: "Existing Title",
      content_hash: "mockhash123",
      status: "ready",
      failure_reason: null,
      page_count: 5,
      chunks_total: 10,
      chunks_embedded_count: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const validPdfBuffer = Buffer.from("%PDF-1.4\nDuplicate PDF Stream\n%%EOF");
    const req = createMockRequestWithFile(validPdfBuffer, "duplicate.pdf");

    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.documentId).toBe("existing-doc-uuid");
    expect(json.status).toBe("ready");
    expect(docDb.createDocument).not.toHaveBeenCalled();
  });

  it("records failed status when PDF parsing fails", async () => {
    vi.spyOn(docDb, "getReadyDocumentByHash").mockResolvedValue(null);
    vi.spyOn(docDb, "createDocument").mockResolvedValue({
      id: MOCK_DOC_ID,
      title: "Broken PDF",
      content_hash: "brokenhash",
      status: "processing",
      failure_reason: null,
      page_count: null,
      chunks_total: null,
      chunks_embedded_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.spyOn(defaultPdfParser, "parse").mockRejectedValue(new Error("Corrupted stream structure"));
    vi.spyOn(docDb, "updateDocumentStatus").mockResolvedValue({
      id: MOCK_DOC_ID,
      title: "Broken PDF",
      content_hash: "brokenhash",
      status: "failed",
      failure_reason: "unknown",
      page_count: null,
      chunks_total: null,
      chunks_embedded_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const validPdfBuffer = Buffer.from("%PDF-1.4\nBroken Stream\n%%EOF");
    const req = createMockRequestWithFile(validPdfBuffer, "broken.pdf");

    const response = await POST(req);
    expect(response.status).toBe(500);
    expect(docDb.updateDocumentStatus).toHaveBeenCalledWith(MOCK_DOC_ID, "failed", "unknown");
  });
});
