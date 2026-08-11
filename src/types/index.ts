/**
 * Core Domain Types & Interfaces for The Socratic Cross-Examiner
 */

export type DocumentStatus = "processing" | "ready" | "failed";

export type QuizMode = "identify_truth" | "identify_both_lies";

export type QuestionDifficulty = "foundational" | "intermediate" | "advanced";

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Standard Error Response Envelope per SRS & API specification
 */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Ingested PDF Document entity
 */
export interface Document {
  id: string;
  title: string;
  contentHash: string;
  status: DocumentStatus;
  failureReason?: string | null;
  chunksEmbeddedCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Semantic Text Chunk with vector embedding reference & provenance
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  tokenCount: number;
  pageStart?: number;
  pageEnd?: number;
  paragraphStart?: number;
  paragraphEnd?: number;
  heading?: string;
  createdAt: string;
}

/**
 * Generated Devil's Advocate Question
 */
export interface QuizQuestion {
  id: string;
  documentId: string;
  concept: string;
  difficulty: QuestionDifficulty;
  groundingChunkIds: string[];
  generationModel: string;
  createdAt: string;
}

/**
 * Statement attached to a Quiz Question (2 lies, 1 truth)
 */
export interface QuizStatement {
  id: string;
  questionId: string;
  text: string;
  isTrue: boolean;
  groundingRationale?: string;
  displayOrder: number;
}

/**
 * Public statement view presented to users (hides `isTrue` and rationale)
 */
export interface PublicQuizStatement {
  statementId: string;
  text: string;
}

/**
 * Quiz Question response shape delivered to clients
 */
export interface QuizQuestionResponse {
  questionId: string;
  concept: string;
  difficulty: QuestionDifficulty;
  statements: PublicQuizStatement[];
}

/**
 * Active User Study Session
 */
export interface UserSession {
  id: string;
  documentId: string;
  sessionToken: string;
  mode: QuizMode;
  createdAt: string;
}

/**
 * Recorded User Answer & Confidence Level
 */
export interface SessionAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  selectedStatementIds: string[];
  isCorrect: boolean;
  confidenceLevel: ConfidenceLevel;
  evidenceViewed: boolean;
  answeredAt: string;
}

/**
 * Confidence Tracer Point for analytics
 */
export interface ConfidenceTracerPoint {
  answeredAt: string;
  questionConcept: string;
  confidenceLevel: ConfidenceLevel;
  correct: boolean;
  usedEvidence: boolean;
}

/**
 * Session Evaluation & Confidence Tracer summary payload
 */
export interface SessionResults {
  sessionId: string;
  documentTitle: string;
  totalAnswered: number;
  accuracy: number;
  confidenceTracer: {
    points: ConfidenceTracerPoint[];
    rollingGap: number;
    overconfidenceRate: number;
    underconfidenceRate: number;
  };
  confidenceGapAlert: boolean;
}

/**
 * Source Grounded RAG Evidence Result
 */
export interface EvidenceResult {
  questionId: string;
  evidenceText: string;
  chunkId: string;
  pageStart?: number;
  pageEnd?: number;
  paragraphStart?: number;
  paragraphEnd?: number;
  heading?: string;
  similarityScore: number;
}
