"use client";

import { use } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuizPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function QuizPage({ params }: QuizPageProps) {
  const { sessionId } = use(params);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Session Header / Progress */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20 mb-1">
            Devil&apos;s Advocate Mode
          </Badge>
          <h1 className="text-xl font-bold text-slate-100">Cross-Examination Session</h1>
          <p className="text-xs text-slate-500 font-mono">Session ID: {sessionId}</p>
        </div>
        <div className="w-full sm:w-48 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span className="font-semibold text-slate-200">Question 1 of 5</span>
          </div>
          <Progress value={20} className="h-2" />
        </div>
      </div>

      {/* Question Card Placeholder */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
              Foundational Concept
            </Badge>
            <span className="text-xs text-slate-500">Spot the TRUE statement</span>
          </div>
          <CardTitle className="text-lg text-slate-100 pt-2">
            Which of the following statements accurately represents the core argument presented in the document?
          </CardTitle>
          <CardDescription className="text-slate-400">
            Select the single true statement. Two of the statements are plausible misconceptions (lies).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors cursor-pointer text-sm text-slate-300">
            Statement A: Placeholder statement option 1 (misconception)
          </div>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors cursor-pointer text-sm text-slate-300">
            Statement B: Placeholder statement option 2 (grounded truth)
          </div>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors cursor-pointer text-sm text-slate-300">
            Statement C: Placeholder statement option 3 (misconception)
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Confidence Level: Unstated</span>
          </div>
          <Button disabled className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white">
            Submit Answer & Reveal Evidence
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
