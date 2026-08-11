import Link from "next/link";
import { ArrowRight, ShieldCheck, HelpCircle, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <Badge variant="secondary" className="px-3 py-1 text-xs border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
          <Zap className="w-3.5 h-3.5 mr-1 text-indigo-400" />
          Devil&apos;s Advocate Socratic Learning
        </Badge>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent leading-tight">
          Master Your Reading Through Cross-Examination
        </h1>
        
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Upload any PDF document. Our AI constructs challenging <span className="text-indigo-300 font-medium">2 Lies + 1 Truth</span> Socratic questions grounded strictly in your source text to eliminate illusions of competence.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/upload">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-600/30 px-8">
              <span>Upload Document</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-100">Devil&apos;s Advocate Method</h3>
            <p className="text-sm text-slate-400">
              Identify plausible misconceptions designed to test deep conceptual comprehension rather than shallow recall.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-100">Source Grounded RAG</h3>
            <p className="text-sm text-slate-400">
              Every statement and answer is verified against original vector-embedded PDF source paragraphs with zero hallucinations.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-100">Confidence Tracer</h3>
            <p className="text-sm text-slate-400">
              Track your calibrated confidence against actual accuracy to highlight knowledge blind spots and overconfidence.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* How It Works Steps */}
      <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-slate-100 text-center">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold mx-auto flex items-center justify-center text-sm">1</div>
            <h4 className="font-medium text-slate-200">Upload PDF</h4>
            <p className="text-xs text-slate-400">Parse & chunk documents up to 50 MB with provenance tracking.</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold mx-auto flex items-center justify-center text-sm">2</div>
            <h4 className="font-medium text-slate-200">Cross-Examination Quiz</h4>
            <p className="text-xs text-slate-400">Spot the single true statement amidst subtle lies and state your confidence.</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold mx-auto flex items-center justify-center text-sm">3</div>
            <h4 className="font-medium text-slate-200">Review RAG Evidence</h4>
            <p className="text-xs text-slate-400">Instantly reveal exact source text paragraphs backing the truth.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
