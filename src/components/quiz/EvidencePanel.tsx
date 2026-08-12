import React from "react";
import type { EvidenceResult } from "@/lib/rag/evidence";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface EvidencePanelProps {
  evidence: EvidenceResult;
  aiHint?: string;
  targetSentence?: string;
  className?: string;
}

/**
 * Format page citation text.
 */
export function formatPageCitation(pageStart: number, pageEnd: number): string {
  if (pageStart === pageEnd) {
    return `Page ${pageStart}`;
  }
  return `Pages ${pageStart}–${pageEnd}`;
}

/**
 * Format paragraph citation text.
 */
export function formatParagraphCitation(paraStart: number, paraEnd: number): string {
  if (paraStart === paraEnd) {
    return `¶${paraStart}`;
  }
  return `¶${paraStart}–${paraEnd}`;
}

/**
 * Highlight a target sentence or phrase within source text using HTML <mark> tags.
 */
export function highlightSourceText(fullText: string, target?: string): React.ReactNode {
  if (!target || !target.trim()) {
    return fullText;
  }

  const cleanTarget = target.trim();
  const index = fullText.toLowerCase().indexOf(cleanTarget.toLowerCase());

  if (index === -1) {
    return fullText;
  }

  const before = fullText.slice(0, index);
  const match = fullText.slice(index, index + cleanTarget.length);
  const after = fullText.slice(index + cleanTarget.length);

  return (
    <>
      {before}
      <mark className="bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 text-amber-950 font-medium px-1 py-0.5 rounded">
        {match}
      </mark>
      {after}
    </>
  );
}

/**
 * EvidencePanel Component (FR-RAG-4, FR-RAG-5).
 * Renders source evidence passage as the primary element in DOM order.
 * Any optional AI orientation hint is rendered strictly below the source excerpt.
 */
export function EvidencePanel({
  evidence,
  aiHint,
  targetSentence,
  className = "",
}: EvidencePanelProps) {
  const pageText = formatPageCitation(evidence.page_start, evidence.page_end);
  const paraText = formatParagraphCitation(evidence.paragraph_start, evidence.paragraph_end);
  const similarityPct = Math.round(evidence.similarity_score * 100);

  return (
    <div
      className={`space-y-4 data-evidence-panel ${className}`}
      data-testid="evidence-panel-container"
    >
      {/* 1. PRIMARY DOM ELEMENT: Source Document Evidence (FR-RAG-5) */}
      <Card
        className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60 shadow-sm"
        data-testid="primary-source-evidence-card"
        role="region"
        aria-label="Source Document Evidence"
      >
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <Badge variant="outline" className="font-semibold text-xs border-amber-400 dark:border-amber-700">
                📄 {pageText}, {paraText}
              </Badge>

              {evidence.heading && (
                <Badge variant="secondary" className="text-xs max-w-xs truncate" title={evidence.heading}>
                  {evidence.heading}
                </Badge>
              )}

              {evidence.is_origin_chunk && (
                <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700">
                  Origin Source
                </Badge>
              )}
            </div>

            <Badge variant="outline" className="text-xs text-muted-foreground">
              {similarityPct}% Match
            </Badge>
          </div>

          <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-300 mt-2">
            Source Passage Evidence
          </CardTitle>
        </CardHeader>

        <CardContent>
          <blockquote className="border-l-4 border-amber-500 pl-4 py-1 my-1 text-sm leading-relaxed text-foreground italic">
            &ldquo;{highlightSourceText(evidence.text, targetSentence)}&rdquo;
          </blockquote>

          <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Sentence coords: {evidence.sentence_start}–{evidence.sentence_end}
            </span>
            <span>Chunk ID: {evidence.chunk_id.slice(0, 8)}...</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. SECONDARY DOM ELEMENT: Optional AI Orientation Hint (FR-RAG-5) */}
      {aiHint && (
        <Card
          className="border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-800"
          data-testid="secondary-ai-hint-card"
          role="region"
          aria-label="AI Orientation Hint"
        >
          <CardHeader className="py-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <span>🤖</span> AI Orientation Hint
              </span>
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                Secondary
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-2 text-xs text-muted-foreground leading-relaxed">
            {aiHint}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
