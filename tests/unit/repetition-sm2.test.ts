import { describe, it, expect } from "vitest";
import {
  calculateQualityFromAnswer,
  calculateSm2,
  type Sm2Input,
} from "@/lib/repetition/sm2";

describe("Spaced Repetition SM-2 & Metacognitive Calibration Engine", () => {
  describe("calculateQualityFromAnswer", () => {
    it("maps blind spots (high confidence incorrect) to quality grade 1", () => {
      expect(calculateQualityFromAnswer(false, 5)).toBe(1);
      expect(calculateQualityFromAnswer(false, 4)).toBe(1);
    });

    it("maps recognized uncertainty (low confidence incorrect) to quality grade 2", () => {
      expect(calculateQualityFromAnswer(false, 3)).toBe(2);
      expect(calculateQualityFromAnswer(false, 2)).toBe(2);
      expect(calculateQualityFromAnswer(false, 1)).toBe(2);
    });

    it("maps lucky guesses / hunches (low confidence correct) to quality grade 3", () => {
      expect(calculateQualityFromAnswer(true, 1)).toBe(3);
      expect(calculateQualityFromAnswer(true, 2)).toBe(3);
    });

    it("maps moderate confidence correct to quality grade 4", () => {
      expect(calculateQualityFromAnswer(true, 3)).toBe(4);
    });

    it("maps high confidence correct (mastery) to quality grade 5", () => {
      expect(calculateQualityFromAnswer(true, 4)).toBe(5);
      expect(calculateQualityFromAnswer(true, 5)).toBe(5);
    });
  });

  describe("calculateSm2 Algorithm", () => {
    const baseDate = new Date("2026-10-01T12:00:00Z");

    it("sets interval to 1 day on first successful repetition (count 0)", () => {
      const input: Sm2Input = {
        repetitionCount: 0,
        intervalDays: 1,
        easeFactor: 2.5,
        quality: 4,
      };

      const result = calculateSm2(input, baseDate);
      expect(result.intervalDays).toBe(1);
      expect(result.repetitionCount).toBe(1);
      expect(result.status).toBe("strengthening");

      const expectedDate = new Date(baseDate);
      expectedDate.setDate(expectedDate.getDate() + 1);
      expect(result.nextReviewAt.toISOString()).toBe(expectedDate.toISOString());
    });

    it("advances interval to 6 days on second successful repetition (count 1)", () => {
      const input: Sm2Input = {
        repetitionCount: 1,
        intervalDays: 1,
        easeFactor: 2.5,
        quality: 5,
      };

      const result = calculateSm2(input, baseDate);
      expect(result.intervalDays).toBe(6);
      expect(result.repetitionCount).toBe(2);
      expect(result.status).toBe("retained");
    });

    it("scales interval by ease factor on subsequent repetitions (count >= 2)", () => {
      const input: Sm2Input = {
        repetitionCount: 2,
        intervalDays: 6,
        easeFactor: 2.5,
        quality: 5,
      };

      const result = calculateSm2(input, baseDate);
      // 6 * 2.5 = 15
      expect(result.intervalDays).toBe(15);
      expect(result.repetitionCount).toBe(3);
      expect(result.status).toBe("retained");
    });

    it("assigns mastered status when interval expands beyond 21 days", () => {
      const input: Sm2Input = {
        repetitionCount: 3,
        intervalDays: 15,
        easeFactor: 2.5,
        quality: 5,
      };

      const result = calculateSm2(input, baseDate);
      // 15 * 2.5 = 37.5 -> 38
      expect(result.intervalDays).toBeGreaterThanOrEqual(21);
      expect(result.status).toBe("mastered");
    });

    it("resets repetition count to 0 and interval to 1 day upon failure (quality < 3)", () => {
      const input: Sm2Input = {
        repetitionCount: 4,
        intervalDays: 30,
        easeFactor: 2.4,
        quality: 1, // Missed concept
      };

      const result = calculateSm2(input, baseDate);
      expect(result.repetitionCount).toBe(0);
      expect(result.intervalDays).toBe(1);
      expect(result.status).toBe("needs_review");
    });

    it("never lets ease factor drop below 1.30", () => {
      const input: Sm2Input = {
        repetitionCount: 1,
        intervalDays: 6,
        easeFactor: 1.35,
        quality: 0,
      };

      const result = calculateSm2(input, baseDate);
      expect(result.easeFactor).toBe(1.3);
    });
  });
});
