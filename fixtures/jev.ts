import type { DecisionContext } from "../src/core/types";
export const syntheticContext: DecisionContext = {
  revision: 7,
  mode: "write",
  prefix: "I would like some wa",
  language: "en",
  stableMs: 300,
  task: "Select a literal word completion from the visible local suggestions.",
  candidates: [
    {
      id: "word-water",
      label: "water",
      kind: "word",
      action: "word",
      evidence: "nearby",
      weight: 0.6,
    },
    {
      id: "word-wait",
      label: "wait",
      kind: "word",
      action: "word",
      evidence: "nearby",
      weight: 0.6,
    },
  ],
};
export const syntheticResponse = {
  model: "synthetic-fixture-not-a-live-model",
  answers: {
    target: {
      type: "choice",
      choice: "word-water",
      probabilities: { "word-water": 0.85, "word-wait": 0.1, none: 0.05 },
      confidence: 0.8,
    },
  },
  usage: { input_tokens: 0, output_tokens: 0 },
};
