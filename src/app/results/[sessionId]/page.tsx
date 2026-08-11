import Link from "next/link";
import { Award, Target, AlertTriangle, RotateCcw, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ResultsPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = await params;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Title Header */}
      <div className="space-y-2 text-center sm:text-left">
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
          Session Complete
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Performance Evaluation</h1>
        <p className="text-sm text-slate-400 font-mono">Session ID: {sessionId}</p>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Overall Accuracy</p>
              <p className="text-2xl font-bold text-slate-100">80%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Questions Answered</p>
              <p className="text-2xl font-bold text-slate-100">5 / 5</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Confidence Gap</p>
              <p className="text-2xl font-bold text-emerald-400">+0.10</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Gap Alert */}
      <Alert variant="warning" className="border-amber-500/30 bg-amber-500/10">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <AlertTitle className="text-amber-300">Confidence Calibration Alert</AlertTitle>
        <AlertDescription className="text-amber-200/80">
          You exhibited overconfidence on 1 question. Consider reviewing the source evidence paragraphs to align your confidence with source-verified knowledge.
        </AlertDescription>
      </Alert>

      {/* Confidence Tracer Container Placeholder */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Confidence Tracer Chart</CardTitle>
          <CardDescription className="text-slate-400">
            Visualizes confidence level (1-5) against answer correctness for each question.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center border-t border-slate-800/80 bg-slate-950/40 rounded-b-xl text-sm text-slate-500">
          [ Confidence Tracer Chart Component Shell ]
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <Link href="/upload">
          <Button variant="outline" className="gap-2 border-slate-800 text-slate-300 hover:bg-slate-800">
            <RotateCcw className="w-4 h-4" />
            <span>Study Another Document</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
