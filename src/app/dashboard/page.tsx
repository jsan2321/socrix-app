"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, BookOpen, PlusCircle } from "lucide-react";
import { DashboardDocument } from "@/lib/db/dashboard";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { ReviewQueueCard } from "@/components/dashboard/ReviewQueueCard";
import { Button } from "@/components/ui/button";
import type { DueConceptItem, RepetitionStats } from "@/lib/db/repetition";

import { useI18n } from "@/lib/i18n/context";

type LibraryResponse = { documents: DashboardDocument[]; total: number; page: number; hasMore: boolean };
export default function DashboardPage() {
  const { dict } = useI18n();
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dueConcepts, setDueConcepts] = useState<DueConceptItem[]>([]);
  const [repetitionStats, setRepetitionStats] = useState<RepetitionStats>({ dueCount: 0, totalTracked: 0, masteredCount: 0 });

  const loadPage = useCallback(async (page: number, append = false) => {
    try {
      const response = await fetch(`/api/documents?limit=12&page=${page}`);
      if (!response.ok) throw new Error((await response.json()).error?.message ?? "Unable to load your library");
      const next: LibraryResponse = await response.json();
      setData((current) => append && current ? { ...next, documents: [...current.documents, ...next.documents] } : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your library");
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const loadRepetition = useCallback(async () => {
    try {
      const res = await fetch("/api/repetition/due");
      if (res.ok) {
        const payload = await res.json();
        setDueConcepts(payload.dueConcepts || []);
        if (payload.stats) setRepetitionStats(payload.stats);
      }
    } catch {
      // Repetition load is non-fatal
    }
  }, []);

  const handleDocumentDeleted = useCallback((deletedId: string) => {
    setData((current) =>
      current
        ? {
            ...current,
            total: Math.max(0, current.total - 1),
            documents: current.documents.filter((d) => d.id !== deletedId),
          }
        : current
    );
    void loadRepetition();
  }, [loadRepetition]);

  useEffect(() => {
    void loadPage(1);
    void loadRepetition();
  }, [loadPage, loadRepetition]);
  if (error) return <section className="mx-auto max-w-xl py-16 text-center"><h1 className="font-serif text-3xl font-bold">{dict.dashboard.libraryUnavailable}</h1><p className="mt-3 text-muted-foreground">{error}</p></section>;
  if (!data) return <section className="py-16 text-center text-muted-foreground">{dict.dashboard.loadingLibrary}</section>;
  const completed = data.documents.flatMap((document) => document.sessions).filter((session) => session.totalAnswered > 0);
  const average = completed.length ? Math.round(completed.reduce((sum, session) => sum + session.accuracy, 0) / completed.length * 100) : 0;
  return (
    <div className="mx-auto max-w-6xl space-y-8 py-4">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">{dict.dashboard.headerPre}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">{dict.dashboard.heading}</h1>
          <p className="mt-2 text-muted-foreground">{dict.dashboard.subtitle}</p>
        </div>
        {data.total > 0 && (
          <Link href="/upload">
            <Button className="gap-2"><PlusCircle className="h-4 w-4" />{dict.dashboard.uploadBtn}</Button>
          </Link>
        )}
      </section>
      {data.total === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 font-serif text-2xl font-bold">{dict.dashboard.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{dict.dashboard.emptyDesc}</p>
          <Link href="/upload" className="mt-6 inline-block"><Button>{dict.dashboard.emptyBtn}</Button></Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{dict.dashboard.docsCount}</p><p className="mt-1 font-serif text-3xl font-bold">{data.total}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{dict.dashboard.completedSessions}</p><p className="mt-1 font-serif text-3xl font-bold">{completed.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{dict.dashboard.avgAccuracy}</p><p className="mt-1 flex items-center gap-2 font-serif text-3xl font-bold">{average}% <BarChart3 className="h-5 w-5 text-primary" /></p></div>
          </section>
          <ReviewQueueCard dueConcepts={dueConcepts} stats={repetitionStats} />
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {data.documents.map((document) => <DocumentCard key={document.id} document={document} onDeleted={handleDocumentDeleted} />)}
          </section>
          {data.hasMore && (
            <div className="text-center">
              <Button variant="outline" onClick={() => { setLoadingMore(true); void loadPage(data.page + 1, true); }} disabled={loadingMore}>
                {loadingMore ? dict.common.loading : dict.dashboard.loadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
