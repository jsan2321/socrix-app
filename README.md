# 🎓 The Socratic Cross-Examiner — AI Retrieval Practice

> **Eliminate illusions of competence through source-grounded "2 Lies + 1 Truth" Socratic cross-examination.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

---

## 🌟 Overview

**The Socratic Cross-Examiner** is an AI-powered retrieval practice platform designed to test deep conceptual understanding of text rather than shallow recall.

Traditional quizzes ask you to recall factual statements. The Socratic Cross-Examiner takes any uploaded PDF document, breaks it down into semantic chunks, and generates **"2 Lies + 1 Truth"** Socratic challenge questions. The distractors ("lies") are designed by a Devil's Advocate AI engine to target subtle, highly plausible misconceptions—forcing learners to rigorously distinguish truth from falsehood.

---

## ✨ Key Features

- 📄 **PDF Parser & Semantic Chunker**: Parses documents up to 50MB and chunks them by headers/paragraphs with exact page & sentence coordinates.
- ⚡ **Source-Grounded RAG (Zero Hallucinations)**: Embeds document chunks into Supabase using `pgvector` (`text-embedding-3-small`) to ground every statement directly in original text.
- 🎯 **Devil's Advocate Socratic Engine**: Generates 2 subtle lies + 1 true statement per question, forcing deep analytical evaluation.
- 📊 **Confidence & Calibration Analytics**: Tracks user accuracy against stated confidence levels to highlight overconfidence bias and knowledge blind spots.
- 🔌 **Multi-Provider LLM Abstraction**: Supports **DeepSeek** (`deepseek-chat`), **OpenAI** (`gpt-4o-mini`, `gpt-4o`), and **Qwen** out of the box with fallback support.
- 🛡️ **Strict Zod Schema Validation**: Automated repair and validation loop ensuring zero malformed JSON responses.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS + Lucide Icons + Shadcn UI |
| **Database & Vector Search** | Supabase PostgreSQL + `pgvector` extension |
| **AI Providers** | DeepSeek V3, OpenAI, Qwen (OpenAI-compatible adapter pattern) |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536-dim) |
| **Testing** | Vitest (Unit & Integration) + Playwright (E2E) |

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **Supabase Account**: Free project on [supabase.com](https://supabase.com) OR local Docker Supabase CLI.
- **AI API Key**: DeepSeek API Key, OpenAI API Key, or Qwen API Key.

### 2. Environment Setup

Clone the repository and create your `.env.local` file inside `socratic-cross-examiner/`:

```bash
cp .env.example .env.local
```

Configure your `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON=your-supabase-anon-token

# AI Provider Choice ('deepseek' | 'openai' | 'qwen')
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
AI_TEMPERATURE=0.7

# API Keys
DEEPSEEK_API_KEY=sk-your-deepseek-key
OPENAI_API_KEY=sk-your-openai-key  # Required for vector text embeddings

EMBEDDING_MODEL=text-embedding-3-small
MAX_UPLOAD_MB=50
MAX_INGESTION_SECONDS=50
```

### 3. Database Migration Setup

Run the SQL migration scripts in your **Supabase Dashboard -> SQL Editor** (in order):

1. `supabase/migrations/0001_init_extensions.sql` (Enables `pgvector`)
2. `supabase/migrations/0002_documents.sql`
3. `supabase/migrations/0003_document_chunks.sql`
4. `supabase/migrations/0004_quiz_questions_and_statements.sql`
5. `supabase/migrations/0005_sessions_and_answers.sql`
6. `supabase/migrations/0006_match_document_chunks.sql`
7. `supabase/migrations/0007_auth_user_links.sql`
8. `supabase/migrations/0008_dashboard_indexes.sql`
9. `supabase/migrations/0009_quiz_generation_idempotency.sql`

For confirmation and password reset emails, set the Supabase Auth Site URL to your app origin and allow redirects to `http://localhost:3000/auth/callback*` (and the equivalent URL on your deployed domain). The same Supabase anon key should be used for `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON`; the service role key must remain server only.

*Alternatively, if using local Supabase CLI:*
```bash
npx supabase start
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests & Quality Checks

```bash
# Typecheck TypeScript
npm run typecheck

# Run Unit & Integration Tests (Vitest)
npm run test:unit
npm run test:integration

# Run E2E Tests (Playwright)
npm run test:e2e

# Run Complete Release Validation Suite
npm run validate:release

# Run Production Deployment Preflight Check
npm run preflight:deploy

# Run Live Production Smoke Test
TARGET_URL=https://your-domain.vercel.app npm run test:smoke:prod
```

For complete step-by-step production setup instructions, see the [Production Deployment Guide](../docs/deployment-guide.md).

---

## 📁 Project Structure

```
socratic-cross-examiner/
├── src/
│   ├── app/                # Next.js App Router (Upload, Quiz, Results, API)
│   ├── components/         # React UI Components & Evidence Panel
│   ├── lib/
│   │   ├── ai/             # Multi-provider LLM adapters (DeepSeek, OpenAI, Qwen)
│   │   ├── db/             # Supabase database client & pgvector queries
│   │   ├── pdf/            # Semantic chunking & PDF parsing engine
│   │   └── rag/            # Retrieval practice evidence selection
│   ├── schemas/            # Zod validation schemas (DB, Quiz, Ingestion)
│   └── types/              # TypeScript interfaces
├── supabase/
│   └── migrations/         # PostgreSQL + pgvector schema migrations
└── tests/                  # Vitest unit/integration & Playwright E2E tests
```

---
