"use client";

import React, { useState, useRef, DragEvent, ChangeEvent, KeyboardEvent } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface DropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function Dropzone({
  onFileSelected,
  disabled = false,
  className = "",
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelectFile = (file: File) => {
    setError(null);

    // 1. Check file type
    const isPdfType = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdfType) {
      setError("Invalid file format. Only text-extractable PDF files are supported.");
      return;
    }

    // 2. Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Card
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload PDF Document Dropzone"
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none ${
          isDragOver
            ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/30 scale-[1.01]"
            : "border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-indigo-400 dark:hover:border-indigo-500/50"
        } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
        data-testid="dropzone-container"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
          data-testid="dropzone-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-sm">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Drag and drop your PDF study material
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supports textbook chapters, lecture slides, or academic papers (max 50 MB)
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            <FileText className="w-4 h-4" />
            <span>Click or press Enter to browse files</span>
          </div>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
          data-testid="dropzone-error"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
