export type EvaluationEvent = {
  participant: string;
  session: string;
  trial: string;
  kind: "selection" | "gaze" | "blink" | "reading";
  durationMs: number;
  expected?: string;
  actual?: string | null;
  errorDip?: number;
  valid?: boolean;
  falseCommits?: number;
};
const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
};
export function parseEvents(input: string): EvaluationEvent[] {
  return input
    .split(/\r?\n/)
    .filter((s) => s.trim())
    .map((line, index) => {
      const e = JSON.parse(line) as EvaluationEvent;
      if (
        !e ||
        !["selection", "gaze", "blink", "reading"].includes(e.kind) ||
        !["participant", "session", "trial"].every(
          (k) => typeof e[k as keyof EvaluationEvent] === "string",
        ) ||
        !Number.isFinite(e.durationMs) ||
        e.durationMs < 0
      )
        throw new Error(`Invalid event at line ${index + 1}`);
      if (
        e.kind === "gaze" &&
        (typeof e.valid !== "boolean" ||
          (e.valid && (!Number.isFinite(e.errorDip) || e.errorDip! < 0)))
      )
        throw new Error(`Invalid gaze at line ${index + 1}`);
      if (
        e.kind === "reading" &&
        (!Number.isInteger(e.falseCommits) ||
          e.falseCommits! < 0 ||
          e.durationMs <= 0)
      )
        throw new Error(`Invalid reading interval at line ${index + 1}`);
      if (
        ["selection", "blink"].includes(e.kind) &&
        (typeof e.expected !== "string" ||
          !(typeof e.actual === "string" || e.actual === null))
      )
        throw new Error(`Invalid label at line ${index + 1}`);
      return e;
    });
}
function summarize(events: EvaluationEvent[]) {
  const selections = events.filter((e) => e.kind === "selection"),
    gaze = events.filter((e) => e.kind === "gaze"),
    blinks = events.filter((e) => e.kind === "blink"),
    reading = events.filter((e) => e.kind === "reading");
  const intentional = blinks.filter((e) => e.expected === "intentional");
  const readingMinutes = reading.reduce((s, e) => s + e.durationMs, 0) / 60000;
  const errors = gaze.filter((e) => e.valid).map((e) => e.errorDip!);
  return {
    events: events.length,
    selection: {
      trials: selections.length,
      correct: selections.filter((e) => e.expected === e.actual).length,
      abstained: selections.filter((e) => e.actual === null).length,
      accuracy: selections.length
        ? selections.filter((e) => e.expected === e.actual).length /
          selections.length
        : null,
      durationP95Ms: percentile(
        selections.map((e) => e.durationMs),
        0.95,
      ),
    },
    gaze: {
      observations: gaze.length,
      validFraction: gaze.length ? errors.length / gaze.length : null,
      errorP50Dip: percentile(errors, 0.5),
      errorP90Dip: percentile(errors, 0.9),
    },
    blink: {
      intentionalTrials: intentional.length,
      intentionalRecall: intentional.length
        ? intentional.filter((e) => e.actual === "commit").length /
          intentional.length
        : null,
      naturalFalseCommits: blinks.filter(
        (e) => e.expected === "natural" && e.actual === "commit",
      ).length,
    },
    reading: {
      minutes: readingMinutes,
      falseCommitsPerMinute: readingMinutes
        ? reading.reduce((s, e) => s + e.falseCommits!, 0) / readingMinutes
        : null,
    },
  };
}
export function evaluateEvents(events: EvaluationEvent[]) {
  const keys = [
    ...new Set(events.map((e) => JSON.stringify([e.participant, e.session]))),
  ];
  return {
    note: "Descriptive statistics only. Correlated frames are not independent participants; synthetic fixtures are not user evidence.",
    pooled: summarize(events),
    sessions: keys.map((key) => {
      const [participant, session] = JSON.parse(key) as [string, string];
      return {
        participant,
        session,
        ...summarize(
          events.filter(
            (e) => e.participant === participant && e.session === session,
          ),
        ),
      };
    }),
  };
}
