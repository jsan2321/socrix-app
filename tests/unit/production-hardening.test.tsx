// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import type { DashboardDocument } from "@/lib/db/dashboard";

const mockGetDocumentById = vi.hoisted(() => vi.fn());
const mockDeleteDocumentById = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/db/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/documents")>();
  return {
    ...actual,
    getDocumentById: mockGetDocumentById,
    deleteDocumentById: mockDeleteDocumentById,
  };
});

vi.mock("@/lib/db/client", () => ({
  getSupabaseAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

import { DELETE } from "@/app/api/documents/[id]/route";
import { enforceDistributedRateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { NotFoundError, RateLimitError } from "@/lib/errors";

const TEST_BYPASS_USER_ID = "00000000-0000-4000-8000-000000000001";

describe("Production Hardening Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    process.env.AUTH_TEST_BYPASS = "true";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("DELETE /api/documents/[id]", () => {
    const validDocId = "550e8400-e29b-41d4-a716-446655440000";

    it("deletes an owned document and returns { deleted: true, documentId }", async () => {
      mockGetDocumentById.mockResolvedValue({
        id: validDocId,
        user_id: TEST_BYPASS_USER_ID,
        title: "SQL Fundamentals",
      });
      mockDeleteDocumentById.mockResolvedValue(undefined);

      const req = new Request(`http://localhost:3000/api/documents/${validDocId}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: validDocId }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ deleted: true, documentId: validDocId });
      expect(mockDeleteDocumentById).toHaveBeenCalledWith(validDocId);
    });

    it("returns 404 when document is not found", async () => {
      mockGetDocumentById.mockRejectedValue(new NotFoundError("Document not found"));

      const req = new Request(`http://localhost:3000/api/documents/${validDocId}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: validDocId }) });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("DocumentCard deletion UI", () => {
    const sampleDoc: DashboardDocument = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "SQL Fundamentals",
      pageCount: 25,
      chunksTotal: 40,
      status: "ready",
      createdAt: "2026-10-11T00:00:00.000Z",
      bestAccuracy: 0.8,
      averageAccuracy: 0.75,
      sessions: [],
    };

    it("requires confirmation before invoking onDeleted", async () => {
      const onDeleted = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true, documentId: sampleDoc.id }),
      });

      render(<DocumentCard document={sampleDoc} onDeleted={onDeleted} />);

      const deleteBtn = screen.getByRole("button", { name: /delete document|eliminar documento/i });
      fireEvent.click(deleteBtn);

      expect(onDeleted).not.toHaveBeenCalled();

      const confirmBtn = screen.getByRole("button", { name: /delete\?|¿eliminar\?/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`/api/documents/${sampleDoc.id}`, {
          method: "DELETE",
        });
        expect(onDeleted).toHaveBeenCalledWith(sampleDoc.id);
      });
    });
  });

  describe("enforceDistributedRateLimit", () => {
    it("enforces rate limit via Postgres check_rate_limit RPC when NODE_ENV is production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockRpc.mockResolvedValueOnce({
        data: [{ allowed: false, current_count: 5, oldest_epoch_ms: Date.now() }],
        error: null,
      });

      const req = new Request("http://localhost:3000/api/documents", {
        headers: { "x-forwarded-for": "203.0.113.42" },
      });

      await expect(
        enforceDistributedRateLimit(req, {
          keyPrefix: "documents:upload",
          limit: 5,
          windowMs: 3600000,
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("falls back to in-memory rate limiting if RPC is unavailable", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "function check_rate_limit does not exist" },
      });

      const req = new Request("http://localhost:3000/api/documents", {
        headers: { "x-forwarded-for": "203.0.113.99" },
      });

      const options = { keyPrefix: "test:fallback", limit: 1, windowMs: 60000 };
      await enforceDistributedRateLimit(req, options);
      await expect(enforceDistributedRateLimit(req, options)).rejects.toBeInstanceOf(
        RateLimitError
      );
    });
  });
});
