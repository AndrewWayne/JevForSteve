import { describe, it, expect } from "vitest";
import {
  CALIBRATION_POINTS,
  VALIDATION_POINTS,
  fitCalibration,
  predict,
  validationError,
  validationPixelError,
  type Sample,
} from "../src/core/calibration";
const samples: Sample[] = CALIBRATION_POINTS.flatMap((p, i) =>
  Array.from({ length: 20 }, () => ({
    features: [p.x, p.y],
    target: p,
    group: `train-${i}`,
  })),
);
describe("personal screen mapping", () => {
  it("generalizes a synthetic mapping to held-out locations", () => {
    const c = fitCalibration(samples);
    const holdout = VALIDATION_POINTS.map((p, i) => ({
      features: [p.x, p.y],
      target: p,
      group: `validation-${i}`,
    }));
    expect(validationError(c, holdout)).toBeLessThan(0.01);
    expect(validationPixelError(c, holdout, 1920, 1080)).toBeLessThan(15);
  });
  it("requires nine distinct calibration positions", () =>
    expect(() =>
      fitCalibration(samples.map((s) => ({ ...s, group: "same" }))),
    ).toThrow());
  it("rejects malformed features and labels", () => {
    expect(() =>
      fitCalibration(samples.map((s) => ({ ...s, features: [NaN, 1] }))),
    ).toThrow();
    expect(() =>
      fitCalibration(
        samples.map((s) => ({ ...s, target: { x: Infinity, y: 0 } })),
      ),
    ).toThrow();
  });
  it("does not clamp an off-screen prediction into a clickable edge", () => {
    const c = fitCalibration(samples);
    expect(predict(c, [2, 2])!.x).toBeGreaterThan(1);
  });
  it("rejects changed feature dimensionality", () => {
    const c = fitCalibration(samples);
    expect(predict(c, [1, 2, 3])).toBeNull();
    expect(predict(c, [NaN, 2])).toBeNull();
  });
  it("reports failure when no validation data exist", () => {
    const c = fitCalibration(samples);
    expect(validationPixelError(c, [], 1920, 1080)).toBe(Infinity);
  });
  it("does not conceal a non-informative constant predictor", () => {
    const c = fitCalibration(
      samples.map((s) => ({ ...s, features: [0.5, 0.5] })),
    );
    expect(
      validationError(
        c,
        samples.map((s) => ({ ...s, features: [0.5, 0.5] })),
      ),
    ).toBeGreaterThan(0.4);
  });
});
