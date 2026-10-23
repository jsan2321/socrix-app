import biologyData from "./stem-biology-cellular-respiration.json";
import csData from "./stem-cs-operating-systems.json";
import physicsData from "./stem-physics-thermodynamics.json";
import historyData from "./humanities-history-roman-republic.json";
import philosophyData from "./humanities-philosophy-epistemology.json";

export interface EvaluationConcept {
  id: string;
  concept: string;
  difficulty: "foundational" | "intermediate" | "advanced";
  sourceExcerpt: string;
  trueClaim: string;
  falseClaims: [string, string];
  groundingRationale: string;
  provenance: {
    page: number;
    paragraph: number;
    heading: string;
  };
}

export interface EvaluationDataset {
  domain: "stem" | "humanities";
  subject: string;
  title: string;
  concepts: EvaluationConcept[];
}

export const evaluationDatasets: Record<string, EvaluationDataset> = {
  "stem-biology": biologyData as EvaluationDataset,
  "stem-cs": csData as EvaluationDataset,
  "stem-physics": physicsData as EvaluationDataset,
  "humanities-history": historyData as EvaluationDataset,
  "humanities-philosophy": philosophyData as EvaluationDataset,
};

export function getAllConcepts(): Array<EvaluationConcept & { datasetId: string }> {
  const all: Array<EvaluationConcept & { datasetId: string }> = [];
  for (const [datasetId, dataset] of Object.entries(evaluationDatasets)) {
    for (const concept of dataset.concepts) {
      all.push({ ...concept, datasetId });
    }
  }
  return all;
}

export function getDataset(id: string): EvaluationDataset | undefined {
  return evaluationDatasets[id];
}
