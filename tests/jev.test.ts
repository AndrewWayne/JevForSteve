import { describe, it, expect, vi } from "vitest";
import {
  buildJevRequest,
  canAskJev,
  parseDecision,
  requestDecision,
  decisionStillCurrent,
} from "../src/core/jev";
import {
  syntheticContext as c,
  syntheticResponse as response,
} from "../fixtures/jev";
const clone = () => structuredClone(response);
describe("bounded Jev contract", () => {
  it("only lets the UI ask for semantic word ambiguity", () => {
    expect(canAskJev(c)).toBe(true);
    expect(
      canAskJev({
        ...c,
        candidates: c.candidates.map((x) => ({ ...x, kind: "key" })),
      }),
    ).toBe(false);
    expect(canAskJev({ ...c, mode: "desktop" })).toBe(false);
    expect(canAskJev({ ...c, prefix: "" })).toBe(false);
  });
  it("has an explicit abstention and no meaningless extra question for text", () => {
    const r = buildJevRequest(c);
    expect(Object.keys(r.questions)).toEqual(["target"]);
    expect(Object.keys(r.questions.target.criteria)).toEqual([
      "none",
      "word-water",
      "word-wait",
    ]);
    expect(JSON.stringify(r)).not.toContain("weight");
  });
  it("limits transmitted text and does not include geometry or images", () => {
    const r = buildJevRequest({ ...c, prefix: "x".repeat(500) });
    expect(r.state.text.prefix).toHaveLength(160);
    expect(r.state.candidates[0]).not.toHaveProperty("rect");
    expect(r.state).not.toHaveProperty("video");
  });
  it("asks an independent consequence question only for a desktop research context", () =>
    expect(buildJevRequest({ ...c, mode: "desktop" }).questions).toHaveProperty(
      "consequential",
    ));
  it("rejects ambiguous or reserved identifiers", () => {
    expect(() =>
      buildJevRequest({ ...c, candidates: [c.candidates[0], c.candidates[0]] }),
    ).toThrow();
    expect(() =>
      buildJevRequest({
        ...c,
        candidates: [{ ...c.candidates[0], id: "none" }],
      }),
    ).toThrow();
  });
  it("accepts a valid synthetic suggestion without treating it as an action", () => {
    const d = parseDecision(response, c);
    expect(d.target).toBe("word-water");
    expect(d.revision).toBe(7);
    expect(d).not.toHaveProperty("execute");
  });
  it("abstains for weak model evidence", () => {
    const r = clone();
    r.answers.target.probabilities = {
      "word-water": 0.5,
      "word-wait": 0.4,
      none: 0.1,
    };
    expect(parseDecision(r, c).target).toBeNull();
  });
  it("respects none even when high confidence", () => {
    const r = clone();
    r.answers.target.choice = "none";
    r.answers.target.probabilities = {
      "word-water": 0.05,
      "word-wait": 0.05,
      none: 0.9,
    };
    expect(parseDecision(r, c).target).toBeNull();
  });
  it("rejects invented targets, malformed sums and inconsistent winners", () => {
    const r = clone();
    r.answers.target.choice = "invented";
    expect(() => parseDecision(r, c)).toThrow();
    const s = clone();
    s.answers.target.probabilities.none = 0.5;
    expect(() => parseDecision(s, c)).toThrow();
    const t = clone();
    t.answers.target.choice = "word-wait";
    expect(() => parseDecision(t, c)).toThrow();
  });
  it("rejects absent or nonfinite confidence and null responses", () => {
    const r = clone();
    r.answers.target.confidence = NaN;
    expect(() => parseDecision(r, c)).toThrow();
    expect(() => parseDecision(null, c)).toThrow();
  });
  it("requires a valid Noul for desktop but never removes local confirmation", () => {
    const desktop = { ...c, mode: "desktop" as const };
    expect(() => parseDecision(response, desktop)).toThrow();
    const raw = {
      ...response,
      answers: {
        ...response.answers,
        consequential: { type: "noul", noul: 0 },
      },
    };
    expect(parseDecision(raw, desktop).needsConfirmation).toBe(true);
  });
  it("never applies a stale suggestion, a closed-eye suggestion, or a missing target", () => {
    const d = parseDecision(response, c);
    expect(decisionStillCurrent(d, 7, false, 300, ["word-water"])).toBe(true);
    expect(decisionStillCurrent(d, 8, false, 300, ["word-water"])).toBe(false);
    expect(decisionStillCurrent(d, 7, true, 300, ["word-water"])).toBe(false);
    expect(decisionStillCurrent(d, 7, false, 901, ["word-water"])).toBe(false);
    expect(decisionStillCurrent(d, 7, false, 300, [])).toBe(false);
  });
  it("sends the documented endpoint and body through an injected mock transport", async () => {
    const transport = vi.fn(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    );
    const d = await requestDecision(
      c,
      "test-key",
      "test-model",
      transport as typeof fetch,
    );
    expect(d.target).toBe("word-water");
    const [url, options] = transport.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(options.body as string).model).toBe("test-model");
  });
  it("fails without credentials and does not retry errors", async () => {
    const transport = vi.fn(async () => new Response("", { status: 429 }));
    await expect(
      requestDecision(c, "", "test", transport as typeof fetch),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    await expect(
      requestDecision(c, "test", "test", transport as typeof fetch),
    ).rejects.toThrow("429");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
