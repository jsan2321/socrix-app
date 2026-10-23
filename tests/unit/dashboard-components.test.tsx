import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AccuracyTrend } from "@/components/dashboard/AccuracyTrend";
import { DocumentCard } from "@/components/dashboard/DocumentCard";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const document = { id: "doc-1", title: "Cell Biology", status: "ready" as const, createdAt: "2026-09-01T00:00:00.000Z", pageCount: 18, chunksTotal: 32, bestAccuracy: 0.8, averageAccuracy: 0.7, sessions: [{ id: "session-1", createdAt: "2026-09-02T00:00:00.000Z", totalAnswered: 4, accuracy: 0.75 }] };

describe("dashboard components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an accessible trend and empty trend fallback", () => {
    const { rerender } = render(<AccuracyTrend values={[0.5, 0.75]} />);
    expect(screen.getByRole("img", { name: /accuracy trend/i })).toBeTruthy();
    rerender(<AccuracyTrend values={[]} />);
    expect(screen.getByText(/no completed sessions/i)).toBeTruthy();
  });

  it("shows document metadata and expands its session history", () => {
    render(<DocumentCard document={document} />);
    expect(screen.getByText("Cell Biology")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /session history/i }));
    expect(screen.getByRole("list", { name: /past sessions/i })).toBeTruthy();
    expect(screen.getByText(/4 questions/i)).toBeTruthy();
  });

  it("opens mode selection and launches quiz directly without re-uploading", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "new-session-123", sessionToken: "token-456" }),
    });

    render(<DocumentCard document={document} />);
    const startQuizBtn = screen.getByRole("button", { name: /start quiz/i });
    fireEvent.click(startQuizBtn);

    expect(screen.getByText(/select challenge mode/i)).toBeTruthy();
    expect(screen.getByText(/identify truth/i)).toBeTruthy();
    expect(screen.getByText(/identify both lies/i)).toBeTruthy();

    const beginBtn = screen.getByRole("button", { name: /begin cross-examination/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/sessions", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ documentId: "doc-1", mode: "identify_truth", questionTarget: 5, quizLanguage: "auto" }),
      }));
      expect(mockPush).toHaveBeenCalledWith("/quiz/new-session-123");
    });
  });
});
