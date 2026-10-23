import React from "react";
import type { EvidenceResult } from "@/lib/rag/evidence";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";

export interface EvidencePanelProps {
  evidence: EvidenceResult;
  aiHint?: string;
  targetSentence?: string;
  className?: string;
}

/**
 * Format page citation text.
 */
export function formatPageCitation(
  pageStart: number,
  pageEnd: number,
  singleLabel = "Page",
  multiLabel = "Pages"
): string {
  if (pageStart === pageEnd) {
    return `${singleLabel} ${pageStart}`;
  }
  return `${multiLabel} ${pageStart}–${pageEnd}`;
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
 * Evidence panel for source excerpts and optional guidance.
 * Renders source evidence passage as the primary element in DOM order.
 * Any optional AI orientation hint is rendered strictly below the source excerpt.
 */
export function EvidencePanel({
  evidence,
  aiHint,
  targetSentence,
  className = "",
}: EvidencePanelProps) {
  const { dict } = useI18n();
  const pageText = formatPageCitation(evidence.page_start, evidence.page_end, dict.evidence.page, dict.evidence.pages);
  const paraText = formatParagraphCitation(evidence.paragraph_start, evidence.paragraph_end);
  const similarityPct = Math.round(evidence.similarity_score * 100);

  return (
    <div
      className={`space-y-4 data-evidence-panel ${className}`}
      data-testid="evidence-panel-container"
    >
      {/* Primary source document evidence. */}
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
                <Badge variant="default" className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white">
                  {dict.evidence.originChunkBadge}
                </Badge>
              )}
            </div>

            <Badge variant="outline" className="text-xs text-muted-foreground">
              {similarityPct}% {dict.evidence.match}
            </Badge>
          </div>

          <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-300 mt-2">
            {dict.evidence.passageTitle}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <blockquote className="border-l-4 border-amber-500 pl-4 py-2 my-2 text-sm font-serif leading-relaxed text-foreground italic bg-amber-500/5 rounded-r-md">
            &ldquo;{highlightSourceText(evidence.text, targetSentence)}&rdquo;
          </blockquote>

          <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {dict.evidence.sentenceCoords}: {evidence.sentence_start}–{evidence.sentence_end}
            </span>
            <span>{dict.evidence.chunkId}: {evidence.chunk_id.slice(0, 8)}...</span>
          </div>
        </CardContent>
      </Card>

      {/* Optional orientation hint. */}
      {aiHint && (
        <Card
          className="border-border bg-muted/30 shadow-none"
          data-testid="secondary-ai-hint-card"
          role="region"
          aria-label="AI Orientation Hint"
        >
          <CardHeader className="py-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <span>🤖</span> {dict.evidence.aiOrientationHint}
              </span>
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {dict.evidence.secondary}
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
