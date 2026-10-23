import { ImageResponse } from "next/og";
import { getSessionById, getSessionAnswersWithQuestions } from "@/lib/db/sessions";
import { getDocumentById } from "@/lib/db/documents";
import { computeRollingGap } from "@/lib/confidence/gap";
import { getCalibrationAssessment } from "@/lib/export/results-card";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const session = await getSessionById(sessionId);
    const document = await getDocumentById(session.document_id);
    const answers = await getSessionAnswersWithQuestions(sessionId);

    const total = answers.length;
    const correct = answers.filter((a) => a.is_correct).length;
    const masteryPercentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const rollingGap = computeRollingGap(answers, 5);
    const calibration = getCalibrationAssessment(rollingGap);

    const blindSpots = answers.filter((a) => a.confidence_level >= 4 && !a.is_correct).length;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#0d1519",
            color: "#f5f3ee",
            padding: "56px 64px",
            fontFamily: "sans-serif",
            border: "8px solid #1fb59c",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "#1fb59c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0d1519",
                  fontWeight: 900,
                  fontSize: "20px",
                }}
              >
                S
              </div>
              <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "2px", color: "#1fb59c" }}>
                SOCRATIC CROSS-EXAMINER
              </span>
            </div>
            <div
              style={{
                fontSize: "14px",
                padding: "6px 14px",
                borderRadius: "9999px",
                backgroundColor: "rgba(31, 181, 156, 0.15)",
                color: "#1fb59c",
                fontWeight: 600,
                border: "1px solid rgba(31, 181, 156, 0.3)",
              }}
            >
              STUDY DOSSIER
            </div>
          </div>

          {/* Document Title & Topic */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "24px 0" }}>
            <span style={{ fontSize: "16px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Source Material Tested
            </span>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                lineHeight: 1.15,
                color: "#ffffff",
                maxHeight: "110px",
                overflow: "hidden",
              }}
            >
              {document.title}
            </div>
          </div>

          {/* Metrics Row */}
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Metric 1 */}
            <div
              style={{
                flex: 1,
                padding: "20px 24px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px", color: "#9ca3af", fontWeight: 500 }}>Mastery Score</span>
              <span style={{ fontSize: "40px", fontWeight: 900, color: "#1fb59c" }}>
                {masteryPercentage}%
              </span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                {correct} of {total} concepts retained
              </span>
            </div>

            {/* Metric 2 */}
            <div
              style={{
                flex: 1.2,
                padding: "20px 24px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px", color: "#9ca3af", fontWeight: 500 }}>Self-Awareness</span>
              <span style={{ fontSize: "28px", fontWeight: 800, color: "#f5f3ee" }}>
                {calibration.label}
              </span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Metacognitive confidence alignment
              </span>
            </div>

            {/* Metric 3 */}
            <div
              style={{
                flex: 1,
                padding: "20px 24px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px", color: "#9ca3af", fontWeight: 500 }}>Blind Spots</span>
              <span style={{ fontSize: "40px", fontWeight: 900, color: blindSpots > 0 ? "#f59e0b" : "#10b981" }}>
                {blindSpots}
              </span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Illusions of competence unmasked
              </span>
            </div>
          </div>

          {/* Footer Callout */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "20px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "13px",
              color: "#9ca3af",
            }}
          >
            <span>Devil&apos;s Advocate Socratic Retrieval Practice</span>
            <span style={{ color: "#1fb59c", fontWeight: 600 }}>socrix.vercel.app</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response("Failed to generate social card", { status: 500 });
  }
}
