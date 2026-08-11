import { Upload, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="space-y-2 text-center">
        <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
          Document Ingestion
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Upload Study Document</h1>
        <p className="text-sm text-slate-400">
          Upload your PDF to begin semantic chunking, vector embedding, and cross-examination quiz generation.
        </p>
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">PDF File Upload</CardTitle>
          <CardDescription className="text-slate-400">
            Supports standard PDF files up to 50 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dropzone Container Shell */}
          <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-10 text-center transition-colors bg-slate-950/40 cursor-pointer flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Upload className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                Drag and drop your PDF file here, or click to browse
              </p>
              <p className="text-xs text-slate-500">Maximum file size: 50 MB</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Start Cross-Examination</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
