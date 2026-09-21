import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { Observation } from "../core/types";
type Landmark = { x: number; y: number; z: number };
const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
export function extractFeatures(p: Landmark[]) {
  if (p.length < 478) return null;
  const left = dist(p[33], p[133]),
    right = dist(p[362], p[263]);
  if (left < 0.008 || right < 0.008) return null;
  const face = dist(p[33], p[263]);
  const iris = (center: number, a: number, b: number) => [
    (p[center].x - (p[a].x + p[b].x) / 2) / dist(p[a], p[b]),
    (p[center].y - (p[a].y + p[b].y) / 2) / dist(p[a], p[b]),
  ];
  const features = [
    ...iris(468, 33, 133),
    ...iris(473, 362, 263),
    (p[1].x - (p[33].x + p[263].x) / 2) / face,
    (p[1].y - (p[33].y + p[263].y) / 2) / face,
    (p[33].y - p[263].y) / face,
    p[1].x,
    p[1].y,
    face,
  ];
  const openness =
    (dist(p[159], p[145]) / left + dist(p[386], p[374]) / right) / 2;
  return { features, openness };
}
export class CameraTracker {
  private video = document.createElement("video");
  private stream: MediaStream | null = null;
  private model: FaceLandmarker | null = null;
  private frame = 0;
  private stopped = true;
  private lastVideoTime = -1;
  private generation = 0;
  async start(onFrame: (o: Observation) => void, threshold: () => number) {
    this.stop();
    const generation = ++this.generation;
    this.stopped = false;
    try {
      const wasm = await FilesetResolver.forVisionTasks("./wasm");
      const model = await FaceLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath: "./models/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });
      if (this.stopped || generation !== this.generation) {
        model.close();
        return;
      }
      this.model = model;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      if (this.stopped || generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      const tick = () => {
        if (this.stopped || !this.model || generation !== this.generation)
          return;
        const at = performance.now();
        if (
          this.video.currentTime !== this.lastVideoTime &&
          this.video.readyState >= 2
        ) {
          this.lastVideoTime = this.video.currentTime;
          try {
            const result = this.model.detectForVideo(this.video, at);
            const f =
              result.faceLandmarks[0] &&
              extractFeatures(result.faceLandmarks[0]);
            onFrame(
              f
                ? {
                    at,
                    point: null,
                    valid: true,
                    closed: f.openness < threshold(),
                    ...f,
                  }
                : {
                    at,
                    point: null,
                    valid: false,
                    closed: false,
                    reason: "未找到清晰的眼睛",
                  },
            );
          } catch {
            onFrame({
              at,
              point: null,
              valid: false,
              closed: false,
              reason: "眼动追踪暂时中断",
            });
          }
        }
        this.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      if (generation === this.generation) this.stop();
      throw e;
    }
  }
  stop() {
    this.stopped = true;
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.model?.close();
    this.model = null;
    this.video.srcObject = null;
    this.lastVideoTime = -1;
  }
}
