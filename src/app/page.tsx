"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ShieldAlert, GitCommit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function LandingPage() {
  const { dict } = useI18n();

  return (
    <div className="space-y-20 py-4 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-8">
        <p className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-primary">
          {dict.landing.heroPre}
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-foreground leading-[1.15]">
          {dict.landing.heroHeading}
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          {dict.landing.heroDesc}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link href="/upload">
            <Button
              size="lg"
              className="gap-2.5 shadow-sm text-base px-7 h-11"
            >
              <span>{dict.landing.beginBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            {dict.landing.howItWorks}
          </a>
        </div>
      </section>

      {/* Visual Walkthrough / Specimen Preview */}
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <span className="text-xs font-mono font-medium uppercase tracking-wider text-primary">
              {dict.landing.specimenBadge}
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-card-foreground">
              {dict.landing.specimenTitle}
            </h2>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
            {dict.modes.identifyTruth}
          </span>
        </div>

        {/* Mock Statement Cards */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-background/50 flex items-start gap-3.5 transition-colors">
            <span className="w-5 h-5 rounded-full border border-muted-foreground/40 text-muted-foreground flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
              A
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {dict.landing.specimenA}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-3.5 transition-colors">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 font-bold">
              B
            </span>
            <div className="space-y-1">
              <p className="text-sm text-foreground font-medium leading-relaxed">
                {dict.landing.specimenB}
              </p>
              <p className="text-xs text-primary font-medium flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {dict.landing.specimenVerified}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50 flex items-start gap-3.5 transition-colors">
            <span className="w-5 h-5 rounded-full border border-muted-foreground/40 text-muted-foreground flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
              C
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {dict.landing.specimenC}
            </p>
          </div>
        </div>
      </section>

      {/* Asymmetric method overview */}
      <section className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-6">
        <article className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06] p-7 sm:p-8 min-h-[270px] flex flex-col justify-between">
          <div className="absolute -right-10 -top-10 text-primary/[0.06]" aria-hidden="true">
            <ShieldAlert className="w-48 h-48" strokeWidth={1} />
          </div>
          <div className="relative space-y-4 max-w-md">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {dict.landing.methodBadge}
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-foreground">
              {dict.landing.methodTitle}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dict.landing.methodDesc}
            </p>
          </div>
          <div className="relative mt-8 flex items-center gap-3 text-sm font-medium text-foreground">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span>{dict.landing.methodFooter}</span>
          </div>
        </article>

        <div className="grid gap-6">
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm flex gap-4">
            <BookOpen className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-serif font-bold text-lg text-card-foreground">{dict.landing.sourceTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {dict.landing.sourceDesc}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-secondary/45 p-6 flex gap-4 md:ml-8">
            <GitCommit className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-serif font-bold text-lg text-foreground">{dict.landing.confidenceTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {dict.landing.confidenceDesc}
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* How It Works Steps */}
      <section
        id="how-it-works"
        className="rounded-2xl border border-border bg-secondary/30 p-8 sm:p-10 space-y-8 scroll-mt-20"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
            {dict.landing.cycleTitle}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            {dict.landing.cycleDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="space-y-3 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono font-bold flex items-center justify-center text-sm mx-auto sm:mx-0">
              1
            </div>
            <h4 className="font-serif font-bold text-base text-foreground">
              {dict.landing.step1Title}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {dict.landing.step1Desc}
            </p>
          </div>

          <div className="space-y-3 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono font-bold flex items-center justify-center text-sm mx-auto sm:mx-0">
              2
            </div>
            <h4 className="font-serif font-bold text-base text-foreground">
              {dict.landing.step2Title}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {dict.landing.step2Desc}
            </p>
          </div>

          <div className="space-y-3 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono font-bold flex items-center justify-center text-sm mx-auto sm:mx-0">
              3
            </div>
            <h4 className="font-serif font-bold text-base text-foreground">
              {dict.landing.step3Title}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {dict.landing.step3Desc}
            </p>
          </div>
        </div>
      </section>

      {/* Technical Foundations Footer */}
      <section className="text-center space-y-4 py-4 border-t border-border">
        <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
          {dict.landing.archTitle}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>&bull; {dict.landing.archZod}</span>
          <span>&bull; {dict.landing.archMultiAi}</span>
          <span>&bull; {dict.landing.archPgvector}</span>
          <span>&bull; {dict.landing.archZeroHallucination}</span>
        </div>
      </section>
    </div>
  );
}
