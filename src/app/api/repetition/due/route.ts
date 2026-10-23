import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { getDueConceptsForUser, getRepetitionStats } from "@/lib/db/repetition";
import { formatErrorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    let userId: string | null = null;
    try {
      const user = await requireAuthenticatedUser();
      userId = user.id;
    } catch {
      // Guest users simply receive empty repetition queue
      return NextResponse.json({
        dueConcepts: [],
        stats: { dueCount: 0, totalTracked: 0, masteredCount: 0 },
      });
    }

    const [dueConcepts, stats] = await Promise.all([
      getDueConceptsForUser(userId),
      getRepetitionStats(userId),
    ]);

    return NextResponse.json({
      dueConcepts,
      stats,
    });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to retrieve due repetition concepts");
  }
}
