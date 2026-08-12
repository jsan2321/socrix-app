import { describe, it, expect } from "vitest";
import { calculateDifficulty } from "@/lib/quiz/difficulty";

describe("Heuristic Difficulty Scoring (FR-QUIZ-2)", () => {
  it("scores simple introductory text as foundational", () => {
    const simpleText =
      "Water is essential for life. Plants need sunlight to grow. Leaves are green.";
    const difficulty = calculateDifficulty(simpleText);
    expect(difficulty).toBe("foundational");
  });

  it("scores dense academic prose with technical terms as advanced or intermediate", () => {
    const complexText =
      "Michaelis-Menten enzyme kinetics describe hyper-asymptotic velocity trajectories where substrate saturation concentrations dictate thermodynamic equilibrium constants across multi-subunit allosteric conformational states.";
    const difficulty = calculateDifficulty(complexText);
    expect(["intermediate", "advanced"]).toContain(difficulty);
  });
});
