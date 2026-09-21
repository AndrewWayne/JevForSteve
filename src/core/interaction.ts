import type { Observation, Point, Target, Candidate } from "./types.js";
export type BlinkSettings = {
  minMs: number;
  maxMs: number;
  pauseMs: number;
  stableMs: number;
  cooldownMs: number;
};
export const DEFAULT_BLINK: BlinkSettings = {
  minMs: 350,
  maxMs: 850,
  pauseMs: 1400,
  stableMs: 220,
  cooldownMs: 650,
};
export type InteractionEvent =
  | { type: "commit"; target: Target }
  | { type: "pause" };
export class BlinkController {
  private candidate: Target | null = null;
  private since = 0;
  private closeAt: number | null = null;
  private frozen: Target | null = null;
  private revision = 0;
  private frozenRevision = 0;
  private lastAt = 0;
  private cooldownUntil = 0;
  private pausedForClosure = false;
  constructor(public settings: BlinkSettings = { ...DEFAULT_BLINK }) {}
  reset() {
    this.candidate = null;
    this.frozen = null;
    this.closeAt = null;
    this.since = 0;
    this.lastAt = 0;
    this.pausedForClosure = false;
  }
  get isClosed() {
    return this.closeAt !== null;
  }
  stableFor(now: number) {
    return this.candidate ? Math.max(0, now - this.since) : 0;
  }
  update(
    o: Observation,
    target: Target | null,
    revision: number,
  ): InteractionEvent | null {
    if (
      !o.valid ||
      (this.lastAt && (o.at - this.lastAt > 200 || o.at <= this.lastAt))
    ) {
      this.reset();
      this.lastAt = o.at;
      return null;
    }
    this.lastAt = o.at;
    if (o.closed) {
      if (this.closeAt === null) {
        this.closeAt = o.at;
        this.pausedForClosure = false;
        this.frozen =
          this.candidate &&
          this.revision === revision &&
          o.at - this.since >= this.settings.stableMs &&
          o.at >= this.cooldownUntil
            ? { ...this.candidate }
            : null;
        this.frozenRevision = revision;
      }
      if (
        o.at - this.closeAt >= this.settings.pauseMs &&
        !this.pausedForClosure
      ) {
        this.frozen = null;
        this.pausedForClosure = true;
        return { type: "pause" };
      }
      return null;
    }
    if (this.closeAt !== null) {
      const duration = o.at - this.closeAt,
        selected = this.frozen;
      const valid =
        duration >= this.settings.minMs &&
        duration <= this.settings.maxMs &&
        !this.pausedForClosure &&
        this.frozenRevision === revision;
      this.closeAt = null;
      this.frozen = null;
      this.candidate = null;
      this.since = o.at;
      if (valid && selected) {
        this.cooldownUntil = o.at + this.settings.cooldownMs;
        return { type: "commit", target: selected };
      }
    }
    if (target?.id !== this.candidate?.id || revision !== this.revision) {
      this.candidate = target;
      this.since = o.at;
      this.revision = revision;
    }
    return null;
  }
}
export function shortlist(
  point: Point | null,
  targets: Target[],
  radius = 30,
): Candidate[] {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    return [];
  return targets
    .map((t) => {
      const dx = Math.max(
        t.rect.x - point.x,
        0,
        point.x - t.rect.x - t.rect.width,
      );
      const dy = Math.max(
        t.rect.y - point.y,
        0,
        point.y - t.rect.y - t.rect.height,
      );
      const inside = dx === 0 && dy === 0;
      return {
        id: t.id,
        label: t.label,
        kind: t.kind,
        action: t.action,
        evidence: (inside ? "center" : "nearby") as Candidate["evidence"],
        weight: Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius)),
      };
    })
    .filter((c) => c.weight > 0.3)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
}
export function localChoice(candidates: Candidate[]): string | null {
  if (!candidates.length) return null;
  const centers = candidates.filter((c) => c.evidence === "center");
  if (centers.length === 1) return centers[0].id;
  if (candidates.length === 1 && candidates[0].weight > 0.65)
    return candidates[0].id;
  return null;
}
