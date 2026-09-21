import type { Point } from "./types.js";
export type Sample = { features: number[]; target: Point; group: string };
export type Calibration = {
  version: 1;
  mean: number[];
  scale: number[];
  wx: number[];
  wy: number[];
  error: number;
  createdAt: number;
};
export const CALIBRATION_POINTS: Point[] = [0.12, 0.5, 0.88].flatMap((y) =>
  [0.1, 0.5, 0.9].map((x) => ({ x, y })),
);
export const VALIDATION_POINTS: Point[] = [
  { x: 0.3, y: 0.28 },
  { x: 0.7, y: 0.28 },
  { x: 0.3, y: 0.72 },
  { x: 0.7, y: 0.72 },
  { x: 0.5, y: 0.85 },
];
function solve(a: number[][], b: number[]) {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < b.length; c++) {
    let p = c;
    for (let r = c + 1; r < b.length; r++)
      if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    if (Math.abs(m[c][c]) < 1e-10) throw new Error("校准样本不足，请重试");
    const d = m[c][c];
    for (let j = c; j <= b.length; j++) m[c][j] /= d;
    for (let r = 0; r < b.length; r++)
      if (r !== c) {
        const f = m[r][c];
        for (let j = c; j <= b.length; j++) m[r][j] -= f * m[c][j];
      }
  }
  return m.map((row) => row[b.length]);
}
function encode(f: number[], mean: number[], scale: number[]) {
  return [1, ...f.map((v, i) => (v - mean[i]) / scale[i])];
}
export function fitCalibration(samples: Sample[]): Calibration {
  if (samples.length < 45 || new Set(samples.map((s) => s.group)).size < 9)
    throw new Error("需要九个位置的有效样本");
  const d = samples[0].features.length;
  if (
    d < 1 ||
    d > 64 ||
    samples.some(
      (s) =>
        s.features.length !== d ||
        !s.features.every(Number.isFinite) ||
        !Number.isFinite(s.target.x) ||
        !Number.isFinite(s.target.y),
    )
  )
    throw new Error("无效的眼动特征");
  const mean = Array.from(
    { length: d },
    (_, j) =>
      samples.reduce((sum, s) => sum + s.features[j], 0) / samples.length,
  );
  const scale = mean.map((m, j) =>
    Math.max(
      0.0001,
      Math.sqrt(
        samples.reduce((v, s) => v + (s.features[j] - m) ** 2, 0) /
          samples.length,
      ),
    ),
  );
  const rows = samples.map((s) => encode(s.features, mean, scale));
  const a = Array.from({ length: d + 1 }, (_, i) =>
    Array.from(
      { length: d + 1 },
      (_, j) =>
        rows.reduce((sum, r) => sum + r[i] * r[j], 0) +
        (i === j ? (i === 0 ? 0.00001 : 2) : 0),
    ),
  );
  const weights = (axis: "x" | "y") =>
    solve(
      a,
      Array.from({ length: d + 1 }, (_, j) =>
        rows.reduce((sum, r, i) => sum + r[j] * samples[i].target[axis], 0),
      ),
    );
  return {
    version: 1,
    mean,
    scale,
    wx: weights("x"),
    wy: weights("y"),
    error: 1,
    createdAt: Date.now(),
  };
}
export function predict(c: Calibration, features: number[]): Point | null {
  if (features.length !== c.mean.length || !features.every(Number.isFinite))
    return null;
  const row = encode(features, c.mean, c.scale);
  // Do not clamp off-screen predictions into clickable screen edges.
  return {
    x: row.reduce((v, f, i) => v + f * c.wx[i], 0),
    y: row.reduce((v, f, i) => v + f * c.wy[i], 0),
  };
}
export function validationError(c: Calibration, samples: Sample[]): number {
  if (!samples.length) return 1;
  const e = samples
    .map((s) => {
      const p = predict(c, s.features);
      return p ? Math.hypot(p.x - s.target.x, p.y - s.target.y) : 1;
    })
    .sort((a, b) => a - b);
  return e[Math.min(e.length - 1, Math.ceil(e.length * 0.9) - 1)];
}
export function validationPixelError(
  c: Calibration,
  samples: Sample[],
  width: number,
  height: number,
): number {
  if (!samples.length || width <= 0 || height <= 0) return Infinity;
  const errors = samples
    .map((s) => {
      const p = predict(c, s.features);
      return p
        ? Math.hypot((p.x - s.target.x) * width, (p.y - s.target.y) * height)
        : Infinity;
    })
    .sort((a, b) => a - b);
  return errors[
    Math.min(errors.length - 1, Math.ceil(errors.length * 0.9) - 1)
  ];
}
