import { describe, it, expect } from "vitest";
import {
  BlinkController,
  shortlist,
  localChoice,
} from "../src/core/interaction";
import type { Target } from "../src/core/types";

const a: Target = {
  id: "a",
  label: "A",
  kind: "key",
  action: "key",
  value: "a",
  rect: { x: 0, y: 0, width: 80, height: 80 },
};
const b: Target = {
  ...a,
  id: "b",
  label: "B",
  value: "b",
  rect: { x: 100, y: 0, width: 80, height: 80 },
};
function rig() {
  const engine = new BlinkController();
  let at = 0;
  const events: ReturnType<BlinkController["update"]>[] = [];
  function frames(
    n: number,
    closed = false,
    target: Target | null = a,
    revision = 1,
    valid = true,
  ) {
    for (let i = 0; i < n; i++) {
      at += 50;
      const event = engine.update(
        { at, point: { x: 40, y: 40 }, valid, closed },
        target,
        revision,
      );
      if (event) events.push(event);
    }
    return events;
  }
  return {
    engine,
    frames,
    events,
    jump: (ms: number) => {
      at += ms;
    },
  };
}
describe("blink confirmation", () => {
  it("commits a deliberate blink once, after reopening", () => {
    const r = rig();
    r.frames(8);
    r.frames(10, true);
    expect(r.events).toEqual([]);
    r.frames(1);
    r.frames(10);
    expect(r.events).toEqual([{ type: "commit", target: a }]);
  });
  it("ignores a natural short blink", () => {
    const r = rig();
    r.frames(8);
    r.frames(2, true);
    r.frames(1);
    expect(r.events).toEqual([]);
  });
  it("requires a stable visible preselection", () => {
    const r = rig();
    r.frames(2);
    r.frames(10, true);
    r.frames(1);
    expect(r.events).toEqual([]);
  });
  it("freezes the pre-blink target rather than closed-eye coordinates", () => {
    const r = rig();
    r.frames(8);
    r.frames(10, true, b);
    r.frames(1, false, b);
    expect(r.events).toEqual([{ type: "commit", target: a }]);
  });
  it("rejects layout changes during closure", () => {
    const r = rig();
    r.frames(8);
    r.frames(5, true);
    r.frames(5, true, b, 2);
    r.frames(1, false, b, 2);
    expect(r.events).toEqual([]);
  });
  it("rejects a revision change exactly at closure", () => {
    const r = rig();
    r.frames(8);
    r.frames(10, true, b, 2);
    r.frames(1, false, b, 2);
    expect(r.events).toEqual([]);
  });
  it("pauses once after prolonged closure, and does not commit on reopening", () => {
    const r = rig();
    r.frames(8);
    r.frames(40, true);
    r.frames(1);
    expect(r.events).toEqual([{ type: "pause" }]);
  });
  it("ignores intermediate closures longer than the confirmation window", () => {
    const r = rig();
    r.frames(8);
    r.frames(20, true);
    r.frames(1);
    expect(r.events).toEqual([]);
  });
  it("loses armed state on tracking loss", () => {
    const r = rig();
    r.frames(8);
    r.frames(5, true);
    r.frames(1, true, a, 1, false);
    r.frames(5, true);
    r.frames(1);
    expect(r.events).toEqual([]);
  });
  it("rejects a blink spanning a video stall", () => {
    const r = rig();
    r.frames(8);
    r.frames(4, true);
    r.jump(500);
    r.frames(1);
    expect(r.events).toEqual([]);
  });
  it("does not treat repeated timestamps as new evidence", () => {
    const r = rig();
    r.frames(8);
    r.frames(4, true);
    expect(
      r.engine.update(
        { at: 600, point: null, valid: true, closed: false },
        a,
        1,
      ),
    ).toBeNull();
  });
  it("cooldown prevents a second rapid confirmation", () => {
    const r = rig();
    r.frames(8);
    r.frames(10, true);
    r.frames(1);
    r.frames(6);
    r.frames(10, true);
    r.frames(1);
    expect(r.events).toHaveLength(1);
  });
  it("resets stability when the target changes", () => {
    const r = rig();
    r.frames(8);
    r.frames(1, false, b);
    r.frames(10, true, b);
    r.frames(1, false, b);
    expect(r.events).toEqual([]);
  });
  it("does not select without a target", () => {
    const r = rig();
    r.frames(8, false, null);
    r.frames(10, true, null);
    r.frames(1, false, null);
    expect(r.events).toEqual([]);
  });
});
describe("geometry shortlist", () => {
  it("uses exact geometry for an unambiguous hit", () =>
    expect(localChoice(shortlist({ x: 40, y: 40 }, [a, b]))).toBe("a"));
  it("abstains between equally near targets", () =>
    expect(localChoice(shortlist({ x: 90, y: 40 }, [a, b]))).toBeNull());
  it("does not turn off-screen / invalid evidence into a target", () => {
    expect(shortlist(null, [a])).toEqual([]);
    expect(shortlist({ x: NaN, y: 20 }, [a])).toEqual([]);
    expect(shortlist({ x: 1000, y: 1000 }, [a])).toEqual([]);
  });
  it("caps cloud candidates and handles overlapping controls without guessing", () => {
    const ts = Array.from({ length: 8 }, (_, i) => ({ ...a, id: String(i) }));
    expect(shortlist({ x: 20, y: 20 }, ts)).toHaveLength(4);
    expect(localChoice(shortlist({ x: 20, y: 20 }, ts))).toBeNull();
  });
});
