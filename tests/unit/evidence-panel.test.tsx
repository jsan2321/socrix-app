import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  EvidencePanel,
  formatPageCitation,
  formatParagraphCitation,
} from "@/components/quiz/EvidencePanel";
import type { EvidenceResult } from "@/lib/rag/evidence";

const MOCK_EVIDENCE: EvidenceResult = {
  chunk_id: "550e8400-e29b-41d4-a716-446655440101",
  document_id: "550e8400-e29b-41d4-a716-446655440000",
  text: "Mitochondria generate most of the chemical energy needed to power the cell's biochemical reactions.",
  similarity_score: 0.87,
  page_start: 12,
  page_end: 12,
  paragraph_start: 4,
  paragraph_end: 4,
  sentence_start: 1,
  sentence_end: 3,
  heading: "4.1 Powerhouse Mechanism",
  is_origin_chunk: true,
};

describe("EvidencePanel Component (FR-RAG-4, FR-RAG-5)", () => {
  it("formats page and paragraph citations correctly", () => {
    expect(formatPageCitation(5, 5)).toBe("Page 5");
    expect(formatPageCitation(5, 7)).toBe("Pages 5–7");
    expect(formatParagraphCitation(2, 2)).toBe("¶2");
    expect(formatParagraphCitation(2, 4)).toBe("¶2–4");
  });

  it("renders primary source document evidence with provenance coordinates and heading", () => {
    render(<EvidencePanel evidence={MOCK_EVIDENCE} />);

    expect(screen.getByText(/Page 12, ¶4/i)).toBeDefined();
    expect(screen.getByText("4.1 Powerhouse Mechanism")).toBeDefined();
    expect(screen.getByText("Origin Source")).toBeDefined();
    expect(screen.getByText("87% Match")).toBeDefined();
    expect(
      screen.getByText(
        /Mitochondria generate most of the chemical energy needed/i
      )
    ).toBeDefined();
  });

  it("highlights target sentence text using native <mark> element", () => {
    const { container } = render(
      <EvidencePanel
        evidence={MOCK_EVIDENCE}
        targetSentence="generate most of the chemical energy"
      />
    );

    const markEl = container.querySelector("mark");
    expect(markEl).not.toBeNull();
    expect(markEl?.textContent).toBe("generate most of the chemical energy");
  });

  it("enforces DOM order: source evidence is primary and renders BEFORE secondary AI hint (AC-RAG-5a)", () => {
    render(
      <EvidencePanel
        evidence={MOCK_EVIDENCE}
        aiHint="Focus on the specific organelles responsible for ATP production."
      />
    );

    const primaryCard = screen.getByTestId("primary-source-evidence-card");
    const secondaryHintCard = screen.getByTestId("secondary-ai-hint-card");

    expect(primaryCard).toBeDefined();
    expect(secondaryHintCard).toBeDefined();

    // Verify DOM order: primary source card precedes secondary AI hint card
    const positionBitmask = primaryCard.compareDocumentPosition(secondaryHintCard);
    expect(positionBitmask & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
  });
});
