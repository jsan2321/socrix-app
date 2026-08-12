import { z } from "zod";

export const QuizStatementSchema = z.object({
  text: z.string().min(20, "Statement text must be at least 20 characters").max(400, "Statement text cannot exceed 400 characters"),
  isTrue: z.boolean(),
  groundingRationale: z.string().min(10, "Grounding rationale must be at least 10 characters").max(300, "Grounding rationale cannot exceed 300 characters"),
});

export const DevilsAdvocateSchema = z
  .object({
    concept: z.string().min(3, "Concept title must be at least 3 characters").max(200, "Concept title cannot exceed 200 characters"),
    difficulty: z.enum(["foundational", "intermediate", "advanced"]),
    statements: z.array(QuizStatementSchema).length(3, "Must contain exactly 3 statements"),
  })
  .superRefine((data, ctx) => {
    const trueCount = data.statements.filter((s) => s.isTrue).length;
    if (trueCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected exactly 1 true statement, got ${trueCount}`,
        path: ["statements"],
      });
    }

    const uniqueTexts = new Set(data.statements.map((s) => s.text.trim().toLowerCase()));
    if (uniqueTexts.size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Statements must be distinct (no near-duplicate statement texts)",
        path: ["statements"],
      });
    }
  });

export type QuizStatement = z.infer<typeof QuizStatementSchema>;
export type DevilsAdvocateQuestion = z.infer<typeof DevilsAdvocateSchema>;
