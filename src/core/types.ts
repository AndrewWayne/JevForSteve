export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type Mode = "write" | "desktop";
export type Target = {
  id: string;
  label: string;
  kind: "key" | "word" | "control" | "desktop";
  rect: Rect;
  action: string;
  value?: string;
  nativeId?: string;
};
export type Candidate = {
  id: string;
  label: string;
  action: string;
  kind: Target["kind"];
  evidence: "center" | "nearby";
  weight: number;
};
export type Observation = {
  at: number;
  point: Point | null;
  valid: boolean;
  closed: boolean;
  features?: number[];
  openness?: number;
  reason?: string;
};
export type DecisionContext = {
  revision: number;
  mode: Mode;
  prefix: string;
  candidates: Candidate[];
  language: "en" | "zh";
  stableMs: number;
  task: string;
};
export type Decision = {
  revision: number;
  target: string | null;
  needsConfirmation: boolean;
  source: "jev" | "local";
  reason: string;
  elapsedMs?: number;
  probabilities?: Record<string, number>;
};
export type DesktopSnapshot = {
  hwnd: string;
  title: string;
  capturedAt: number;
  targets: Target[];
  token: string;
  error?: string;
};
export type HostInfo = {
  desktop: boolean;
  platform: string;
  jevAvailable: boolean;
  display: Rect;
  bounds: Rect;
  nativeSupported: boolean;
};
export type NativeResult = { ok: boolean; message: string };
export interface HostBridge {
  info(): Promise<HostInfo>;
  resize(mode: "compact" | "expanded" | "calibration"): Promise<void>;
  decide(context: DecisionContext): Promise<Decision>;
  snapshot(): Promise<DesktopSnapshot>;
  execute(request: {
    token: string;
    targetId: string;
    action: "click" | "scrollUp" | "scrollDown" | "text";
    text?: string;
  }): Promise<NativeResult>;
  enableNative(enabled: boolean): Promise<void>;
  quit(): void;
  onPause(callback: () => void): () => void;
}
