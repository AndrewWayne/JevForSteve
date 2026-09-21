import { it, expect } from "vitest";
import { parseEvents, evaluateEvents } from "../src/core/evaluation";
it("reports abstentions separately and does not count them as correct", () => {
  const r = evaluateEvents([
    {
      participant: "p",
      session: "s",
      trial: "1",
      kind: "selection",
      durationMs: 1000,
      expected: "a",
      actual: null,
    },
  ]);
  expect(r.pooled.selection.accuracy).toBe(0);
  expect(r.pooled.selection.abstained).toBe(1);
});
it("uses reading exposure time for false commits per minute", () => {
  const r = evaluateEvents([
    {
      participant: "p",
      session: "s",
      trial: "1",
      kind: "reading",
      durationMs: 300000,
      falseCommits: 1,
    },
  ]);
  expect(r.pooled.reading.falseCommitsPerMinute).toBe(0.2);
});
it("does not fabricate a rate without a denominator", () => {
  const r = evaluateEvents([]);
  expect(r.pooled.selection.accuracy).toBeNull();
  expect(r.pooled.gaze.errorP90Dip).toBeNull();
  expect(r.pooled.blink.intentionalRecall).toBeNull();
});
it("rejects invalid data before aggregation", () =>
  expect(() => parseEvents('{"kind":"gaze","durationMs":33}')).toThrow());
it("keeps participant/session results distinct", () => {
  const base = {
    trial: "1",
    kind: "selection" as const,
    durationMs: 1000,
    expected: "a",
    actual: "a",
  };
  const r = evaluateEvents([
    { ...base, participant: "p", session: "one" },
    { ...base, participant: "p", session: "two" },
    { ...base, participant: "q", session: "one", actual: "b" },
  ]);
  expect(r.sessions).toHaveLength(3);
  expect(r.pooled.selection.accuracy).toBeCloseTo(2 / 3);
});
