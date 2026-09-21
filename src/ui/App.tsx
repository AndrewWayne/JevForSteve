import { useEffect, useRef, useState } from "react";
import { host } from "../host";
import { CameraTracker } from "../vision/camera";
import {
  CALIBRATION_POINTS,
  VALIDATION_POINTS,
  fitCalibration,
  predict,
  validationError,
  validationPixelError,
  type Calibration,
  type Sample,
} from "../core/calibration";
import {
  BlinkController,
  DEFAULT_BLINK,
  shortlist,
  localChoice,
  type BlinkSettings,
} from "../core/interaction";
import { decisionStillCurrent, canAskJev } from "../core/jev";
import type {
  Point,
  Target,
  Observation,
  HostInfo,
  Mode,
  DesktopSnapshot,
  Decision,
} from "../core/types";

const words = [
  "hello",
  "help",
  "please",
  "thank",
  "thanks",
  "water",
  "want",
  "need",
  "love",
  "you",
  "yes",
  "no",
  "not",
  "stop",
  "wait",
  "comfortable",
  "uncomfortable",
  "family",
  "tomorrow",
  "today",
  "good",
  "morning",
];
const phrases = [
  "我需要帮助",
  "请等一下，我在输入",
  "我想喝水",
  "我想休息一下",
  "谢谢你",
  "我爱你",
];
const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const groups = ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZ .?!"];
const initialHost: HostInfo = {
  desktop: false,
  platform: "browser",
  jevAvailable: false,
  display: { x: 0, y: 0, width: innerWidth, height: innerHeight },
  bounds: { x: 0, y: 0, width: innerWidth, height: innerHeight },
  nativeSupported: false,
};
type CalibrationRun = {
  index: number;
  phase: "train" | "validate";
  started: number;
  samples: Sample[];
  validation: Sample[];
  model?: Calibration;
};
type ConfirmAction = { label: string; action: () => void };
function Icon({ name }: { name: string }) {
  const p: Record<string, string> = {
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    pause: "M8 5v14M16 5v14",
    play: "m8 5 11 7-11 7V5Z",
    chevron: "m7 10 5 5 5-5",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
    speak: "M4 9h4l5-4v14l-5-4H4V9Zm13-2a7 7 0 0 1 0 10m-2-7a3 3 0 0 1 0 4",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    back: "m9 5-7 7 7 7h12V5H9Zm3 4 6 6m0-6-6 6",
    target: "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 12h8m-4-4v8",
    monitor: "M3 4h18v13H3V4Zm5 17h8m-4-4v4",
    close: "m6 6 12 12M18 6 6 18",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={p[name] ?? p.eye} />
    </svg>
  );
}

export default function App() {
  const [info, setInfo] = useState(initialHost),
    [expanded, setExpanded] = useState(true),
    [settings, setSettings] = useState(false);
  const [source, setSource] = useState<"demo" | "camera">("demo"),
    [paused, setPaused] = useState(false),
    [mode, setMode] = useState<Mode>("write");
  const [text, setText] = useState(""),
    [status, setStatus] = useState("移动鼠标预选，按住空格模拟眨眼"),
    [selected, setSelected] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false),
    [cameraStarting, setCameraStarting] = useState(false),
    [calibration, setCalibration] = useState<Calibration | null>(null),
    [calRun, setCalRun] = useState<CalibrationRun | null>(null);
  const [blink, setBlink] = useState<BlinkSettings>({ ...DEFAULT_BLINK }),
    [eyeThreshold, setEyeThreshold] = useState(0.12),
    [grouped, setGrouped] = useState(false),
    [group, setGroup] = useState<string | null>(null);
  const [cloud, setCloud] = useState(false),
    [decision, setDecision] = useState<Decision | null>(null),
    [native, setNative] = useState(false),
    [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null),
    [desktopPage, setDesktopPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null),
    [gaze, setGaze] = useState<Point | null>(null),
    [closed, setClosed] = useState(false),
    [calProgress, setCalProgress] = useState(0),
    [sampleCount, setSampleCount] = useState(0),
    [openLevel, setOpenLevel] = useState(0.2);
  const [blinkTraining, setBlinkTraining] = useState<
      "natural" | "intentional" | null
    >(null),
    [trainingProgress, setTrainingProgress] = useState(0);
  const panel = useRef<HTMLElement>(null),
    camera = useRef(new CameraTracker()),
    engine = useRef(new BlinkController()),
    pointer = useRef<Point | null>(null),
    space = useRef(false),
    cameraRequest = useRef(0);
  const latest = useRef<Observation | null>(null),
    revision = useRef(0),
    selectionKey = useRef(""),
    lastRequest = useRef(0),
    pending = useRef(false),
    lastPaint = useRef(0),
    calRef = useRef<CalibrationRun | null>(null),
    resumeSince = useRef(0);
  const trainRef = useRef<{
    phase: "natural" | "intentional";
    started: number;
    openValues: number[];
    durations: number[];
    closeAt: number | null;
    natural: number[];
  } | null>(null);
  const current = useRef({
    info,
    source,
    paused,
    mode,
    text,
    cloud,
    calibration,
    blink,
    eyeThreshold,
    native,
    snapshot,
    confirm,
    settings,
    calRun,
    decision,
  });
  current.current = {
    info,
    source,
    paused,
    mode,
    text,
    cloud,
    calibration,
    blink,
    eyeThreshold,
    native,
    snapshot,
    confirm,
    settings,
    calRun,
    decision,
  };
  const actRef = useRef<(target: Target) => void>(() => {});
  const frameRef = useRef<(o: Observation) => void>(() => {});
  const setMessage = (s: string) => setStatus(s);
  const resize = async (open: boolean) => {
    setExpanded(open);
    revision.current++;
    engine.current.reset();
    await host.resize(open ? "expanded" : "compact");
    setInfo(await host.info());
  };
  const invalidate = () => {
    revision.current++;
    selectionKey.current = "";
    engine.current.reset();
    setDecision(null);
    setSelected(null);
  };
  const pause = () => {
    setPaused(true);
    setNative(false);
    setSnapshot(null);
    void host.enableNative(false);
    setConfirm(null);
    invalidate();
    setStatus("已暂停 · 注视恢复按钮一秒即可继续");
  };
  const resume = () => {
    setPaused(false);
    invalidate();
    setStatus("已恢复 · 看向目标，再主动眨眼");
  };
  useEffect(() => {
    void host.info().then(setInfo);
    const off = host.onPause(() => {
      pause();
      setNative(false);
    });
    return () => {
      off();
      camera.current.stop();
    };
  }, []);
  useEffect(() => {
    engine.current.settings = blink;
    invalidate();
  }, [blink]);
  useEffect(() => {
    invalidate();
  }, [mode, settings, grouped, group, confirm, text, cloud, desktopPage]);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        pause();
      }
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        current.current.source === "demo"
      ) {
        e.preventDefault();
        space.current = e.type === "keydown";
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    let timer = 0;
    const loop = () => {
      if (current.current.source === "demo")
        frameRef.current({
          at: performance.now(),
          point: pointer.current,
          valid: !!pointer.current,
          closed: space.current,
        });
      else if (latest.current && performance.now() - latest.current.at > 300) {
        engine.current.reset();
        setSelected(null);
        setStatus("追踪中断 · 已停止输入");
      }
      timer = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(timer);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
    };
  }, []);
  useEffect(() => {
    if (!info.desktop) return;
    const timer = setInterval(() => {
      void host.info().then((next) => {
        const old = current.current.info.bounds;
        if (
          old.x !== next.bounds.x ||
          old.y !== next.bounds.y ||
          old.width !== next.bounds.width ||
          old.height !== next.bounds.height
        )
          invalidate();
        setInfo(next);
      });
    }, 250);
    return () => clearInterval(timer);
  }, [info.desktop]);
  const targets = (): Target[] =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-gaze]"),
    )
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          !el.disabled &&
          r.width > 0 &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth
        );
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.gaze!,
          label: el.getAttribute("aria-label") ?? el.innerText,
          kind: (el.dataset.kind as Target["kind"]) ?? "control",
          action: el.dataset.action ?? "control",
          value: el.dataset.value,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        };
      });
  const finishCalibration = async (run: CalibrationRun) => {
    const model = run.model;
    calRef.current = null;
    setCalRun(null);
    invalidate();
    await host.resize("expanded");
    const next = await host.info();
    setInfo(next);
    if (!model) {
      setCalibration(null);
      setStatus("校准失败，请调整姿势后重试");
      return;
    }
    model.error = validationError(model, run.validation);
    const pixelError = validationPixelError(
      model,
      run.validation,
      next.display.width,
      next.display.height,
    );
    if (pixelError > 40 || run.validation.length < 25) {
      setCalibration(null);
      setStatus(
        `校准误差过大（P90 ${Math.round(pixelError)} DIP），请调整条件或测试其他设备`,
      );
      return;
    }
    setCalibration(model);
    setGrouped(true);
    setStatus(
      `校准完成 · 验证 P90 ${Math.round(pixelError)} DIP，请先测试大目标选择`,
    );
  };
  const calibrationFrame = (o: Observation) => {
    const run = calRef.current;
    if (!run || !o.features || !o.valid || o.closed) return;
    const elapsed = o.at - run.started,
      pts = run.phase === "train" ? CALIBRATION_POINTS : VALIDATION_POINTS;
    setCalProgress(Math.min(1, elapsed / 2000));
    if (elapsed > 650) {
      const sample = {
        features: o.features,
        target: pts[run.index],
        group: `${run.phase}-${run.index}`,
      };
      (run.phase === "train" ? run.samples : run.validation).push(sample);
    }
    if (elapsed < 2000) return;
    const own = (run.phase === "train" ? run.samples : run.validation).filter(
      (s) => s.group === `${run.phase}-${run.index}`,
    );
    if (own.length < 12) {
      setStatus("等待清晰的眼部画面");
      return;
    }
    if (run.index + 1 < pts.length) {
      run.index++;
      run.started = o.at;
      setCalRun({ ...run });
      return;
    }
    if (run.phase === "train") {
      try {
        run.model = fitCalibration(run.samples);
        run.phase = "validate";
        run.index = 0;
        run.started = o.at;
        setCalRun({ ...run });
      } catch (e) {
        setStatus((e as Error).message);
        void finishCalibration({ ...run, model: undefined });
      }
      return;
    }
    void finishCalibration(run);
  };
  frameRef.current = (raw: Observation) => {
    latest.current = raw;
    const s = current.current;
    if (raw.openness !== undefined) setOpenLevel(raw.openness);
    if (trainRef.current) {
      const t = trainRef.current;
      const elapsed = raw.at - t.started;
      setTrainingProgress(Math.min(1, elapsed / 10000));
      if (raw.valid && raw.openness !== undefined) {
        t.openValues.push(raw.openness);
        if (raw.closed && t.closeAt === null) t.closeAt = raw.at;
        if (!raw.closed && t.closeAt !== null) {
          t.durations.push(raw.at - t.closeAt);
          t.closeAt = null;
        }
      }
      if (elapsed >= 10000) {
        if (t.phase === "natural") {
          const sorted = t.openValues.sort((a, b) => a - b);
          if (sorted.length)
            setEyeThreshold(sorted[Math.floor(sorted.length * 0.7)] * 0.55);
          trainRef.current = {
            phase: "intentional",
            started: raw.at,
            openValues: [],
            durations: [],
            closeAt: null,
            natural: t.durations,
          };
          setBlinkTraining("intentional");
        } else {
          const natural = t.natural.filter((n) => n > 30 && n < 1000),
            intent = t.durations.filter((n) => n > 120 && n < 1300);
          if (natural.length >= 2 && intent.length >= 2) {
            const n = Math.max(...natural),
              i = Math.min(...intent);
            if (i > n + 60) {
              setBlink((v) => ({
                ...v,
                minMs: Math.round((n + i) / 2),
                maxMs: Math.min(1200, Math.round(Math.max(...intent) + 120)),
                pauseMs: 1800,
              }));
              setStatus("眨眼校准完成");
            } else setStatus("自然与主动眨眼重叠，请调整动作或手动设置时长");
          } else setStatus("有效眨眼样本不足，保留原设置，请重试");
          trainRef.current = null;
          setBlinkTraining(null);
          invalidate();
        }
      }
      return;
    }
    if (calRef.current) {
      calibrationFrame(raw);
      return;
    }
    let point = raw.point;
    if (s.source === "camera") {
      if (!s.calibration || !raw.features) {
        engine.current.reset();
        return;
      }
      const p = predict(s.calibration, raw.features);
      point =
        p && p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1
          ? {
              x:
                s.info.display.x + p.x * s.info.display.width - s.info.bounds.x,
              y:
                s.info.display.y +
                p.y * s.info.display.height -
                s.info.bounds.y,
            }
          : null;
    }
    if (raw.at - lastPaint.current > 60) {
      setGaze(point);
      setClosed(raw.closed);
      lastPaint.current = raw.at;
    }
    const all = targets(),
      radius =
        s.source === "camera"
          ? Math.max(
              18,
              Math.min(
                60,
                (s.calibration?.error ?? 0.02) * s.info.display.width,
              ),
            )
          : 12;
    const list = shortlist(point, all, radius);
    if (s.paused) {
      const hit =
        point &&
        all.some(
          (t) =>
            t.action === "resume" &&
            point.x >= t.rect.x &&
            point.x <= t.rect.x + t.rect.width &&
            point.y >= t.rect.y &&
            point.y <= t.rect.y + t.rect.height,
        );
      if (hit && raw.valid && !raw.closed) {
        if (!resumeSince.current) resumeSince.current = raw.at;
        if (raw.at - resumeSince.current > 1100) {
          resumeSince.current = 0;
          resume();
        }
      } else resumeSince.current = 0;
      return;
    }
    const key = list.map((c) => c.id).join("|");
    if (!raw.closed && key !== selectionKey.current) {
      selectionKey.current = key;
      revision.current++;
      setDecision(null);
    }
    const local = localChoice(list);
    const modelTarget =
      s.decision?.revision === revision.current &&
      list.some((c) => c.id === s.decision?.target)
        ? s.decision.target
        : null;
    // A definite geometrical hit always wins. Jev resolves only unresolved candidates.
    const id = local ?? modelTarget;
    const target = all.find((t) => t.id === id) ?? null;
    if (!raw.closed) setSelected(id);
    const event = engine.current.update(
      { ...raw, point, valid: raw.valid },
      target,
      revision.current,
    );
    if (event?.type === "pause") {
      pause();
      return;
    }
    if (event?.type === "commit") {
      setSampleCount((v) => v + 1);
      actRef.current(event.target);
      return;
    }
    if (
      s.cloud &&
      s.info.jevAvailable &&
      !raw.closed &&
      raw.valid &&
      canAskJev({ mode: s.mode, prefix: s.text, candidates: list }) &&
      !local &&
      !pending.current &&
      raw.at - lastRequest.current > 750
    ) {
      pending.current = true;
      lastRequest.current = raw.at;
      const rev = revision.current,
        start = performance.now();
      void host
        .decide({
          revision: rev,
          mode: s.mode,
          prefix: s.text,
          candidates: list,
          language: /[\u4e00-\u9fff]/.test(s.text) ? "zh" : "en",
          stableMs: engine.current.stableFor(raw.at),
          task: "Select a literal word completion from the visible local suggestions.",
        })
        .then((d) => {
          if (
            current.current.cloud &&
            !current.current.paused &&
            decisionStillCurrent(
              d,
              revision.current,
              engine.current.isClosed,
              performance.now() - start,
              selectionKey.current.split("|"),
            )
          )
            setDecision(d);
        })
        .catch(() => {
          setDecision(null);
        })
        .finally(() => {
          pending.current = false;
        });
    }
  };
  const startCamera = async () => {
    const request = ++cameraRequest.current;
    setCameraStarting(true);
    setStatus("正在启动本地摄像头…");
    invalidate();
    try {
      setSource("camera");
      await camera.current.start(
        (o) => frameRef.current(o),
        () => current.current.eyeThreshold,
      );
      if (request !== cameraRequest.current) return;
      setCameraReady(true);
      setStatus("摄像头已就绪，请进行视线校准");
    } catch {
      if (request !== cameraRequest.current) return;
      setSource("demo");
      setCameraReady(false);
      setStatus("摄像头无法启动：检查权限，并先运行 npm run assets");
    } finally {
      if (request === cameraRequest.current) setCameraStarting(false);
    }
  };
  const useDemo = () => {
    cameraRequest.current++;
    setCameraStarting(false);
    trainRef.current = null;
    setBlinkTraining(null);
    camera.current.stop();
    setSource("demo");
    setCameraReady(false);
    setCalibration(null);
    setPaused(false);
    invalidate();
    setStatus("移动鼠标预选，按住空格 0.35–0.85 秒后松开");
  };
  const startCalibration = async () => {
    if (!cameraReady) {
      setStatus("请先开启摄像头");
      return;
    }
    setSettings(false);
    setCalibration(null);
    setPaused(false);
    invalidate();
    await host.resize("calibration");
    setInfo(await host.info());
    const run: CalibrationRun = {
      phase: "train",
      index: 0,
      started: performance.now(),
      samples: [],
      validation: [],
    };
    calRef.current = run;
    setCalRun(run);
  };
  const refreshDesktop = async () => {
    try {
      const s = await host.snapshot();
      setSnapshot(s);
      setDesktopPage(0);
      invalidate();
      setStatus(s.error ?? `已读取 ${s.targets.length} 个可操作按钮`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const execute = async (
    action: "click" | "scrollUp" | "scrollDown" | "text",
    targetId = "",
    label = "操作",
  ) => {
    if (!snapshot) {
      setStatus("请先读取目标窗口");
      return;
    }
    const token = snapshot.token;
    setConfirm({
      label,
      action: () => {
        void host
          .execute({
            token,
            targetId,
            action,
            text: action === "text" ? text : undefined,
          })
          .then((r) => {
            setStatus(r.message);
            setSnapshot(null);
          })
          .catch((e) => setStatus(String(e)));
      },
    });
  };
  const runControl = (action: string, value?: string) => {
    switch (action) {
      case "key":
        setText((t) => t + (value ?? ""));
        setGroup(null);
        break;
      case "word":
        setText((t) => t.replace(/[a-z]+$/i, "") + (value ?? "") + " ");
        break;
      case "phrase":
        setText((t) => t + (t ? " " : "") + (value ?? ""));
        break;
      case "backspace":
        setText((t) => Array.from(t).slice(0, -1).join(""));
        break;
      case "clear":
        setConfirm({ label: "清空当前文字", action: () => setText("") });
        break;
      case "speak":
        if (text) {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = /[\u4e00-\u9fff]/.test(text) ? "zh-CN" : "en-US";
          speechSynthesis.speak(u);
          setStatus("正在朗读");
        }
        break;
      case "pause":
        pause();
        break;
      case "resume":
        resume();
        break;
      case "expand":
        void resize(true);
        break;
      case "collapse":
        void resize(false);
        break;
      case "settings":
        setSettings((v) => !v);
        break;
      case "group":
        setGroup(value ?? null);
        break;
      case "groups":
        setGroup(null);
        break;
      case "desktop":
        setMode("desktop");
        break;
      case "write":
        setMode("write");
        break;
      case "refresh":
        void refreshDesktop();
        break;
      case "page-prev":
        setDesktopPage((v) => Math.max(0, v - 1));
        break;
      case "page-next":
        setDesktopPage((v) => v + 1);
        break;
      case "native-target": {
        const t = snapshot?.targets.find((t) => t.id === value);
        if (t) void execute("click", t.id, `点击「${t.label}」`);
        break;
      }
      case "scrollUp":
      case "scrollDown":
        void execute(
          action,
          "",
          action === "scrollUp" ? "向上滚动" : "向下滚动",
        );
        break;
      case "insert":
        void execute(
          "text",
          "",
          `将文字输入到「${snapshot?.title ?? "目标窗口"}」`,
        );
        break;
      case "confirm": {
        const a = confirm;
        setConfirm(null);
        a?.action();
        break;
      }
      case "cancel":
        setConfirm(null);
        break;
      case "native": {
        const enabled = !native;
        void host.enableNative(enabled).then(() => {
          setNative(enabled);
          setSnapshot(null);
          setStatus(
            enabled ? "切换到目标窗口，再选择“读取窗口”" : "桌面操作已关闭",
          );
        });
        break;
      }
      case "camera":
        void startCamera();
        break;
      case "calibrate":
        void startCalibration();
        break;
      case "demo":
        useDemo();
        break;
    }
  };
  actRef.current = (t) => {
    if (t.kind === "desktop") {
      void execute("click", t.nativeId ?? t.id, `点击「${t.label}」`);
      return;
    }
    runControl(t.action, t.value);
  };
  const button = (
    id: string,
    label: React.ReactNode,
    action: string,
    value?: string,
    extra: Record<string, unknown> = {},
  ) => (
    <button
      key={id}
      data-gaze={id}
      data-action={action}
      data-value={value}
      data-kind={
        action === "key" ? "key" : action === "word" ? "word" : "control"
      }
      {...extra}
      className={`${extra.className ?? ""} ${selected === id ? "selected" : ""}`}
      onClick={() => runControl(action, value)}
    >
      {label}
    </button>
  );
  const prefix = text.match(/[a-z]+$/i)?.[0] ?? "";
  const suggestions = prefix
    ? words
        .filter(
          (w) =>
            w.startsWith(prefix.toLowerCase()) && w !== prefix.toLowerCase(),
        )
        .slice(0, 3)
    : [];
  const dot = calRun
    ? (calRun.phase === "train" ? CALIBRATION_POINTS : VALIDATION_POINTS)[
        calRun.index
      ]
    : null;
  return (
    <div className={info.desktop ? "app native-app" : "app browser-app"}>
      {!info.desktop && (
        <div className="preview-caption">
          <span className="tiny-mark">J / S</span>
          <div>
            JevForSteve<span>桌面伴侣 · 交互预览</span>
          </div>
          <span className="preview-note">所有输入留在此窗口</span>
        </div>
      )}
      {calRun && dot ? (
        <div className="calibration-screen">
          <div className="calibration-heading">
            <span className="eyebrow">PERSONAL CALIBRATION</span>
            <h1>
              {calRun.phase === "train" ? "跟随这个光点" : "再看几个新位置"}
            </h1>
            <p>
              {calRun.phase === "train"
                ? "保持舒适的姿势，自然地看向光点。"
                : "我们在检查精度，这些位置没有参与校准。"}
            </p>
            <span>
              {calRun.index + 1} / {calRun.phase === "train" ? 9 : 5}
            </span>
          </div>
          <div
            className="calibration-dot"
            style={
              {
                left: `${dot.x * 100}%`,
                top: `${dot.y * 100}%`,
                "--progress": calProgress,
              } as React.CSSProperties
            }
          />
          <button
            className="calibration-cancel"
            onClick={() => {
              calRef.current = null;
              setCalRun(null);
              void resize(true);
            }}
          >
            取消校准
          </button>
        </div>
      ) : (
        <main
          ref={panel}
          className={`panel ${expanded ? "expanded" : "compact"}`}
        >
          <header className="toolbar">
            <div className="brand">
              <span className="brand-icon">
                <Icon name="eye" />
              </span>
              <div>
                <strong>
                  Steve<span className="brand-dot">.</span>
                </strong>
                {expanded && (
                  <span className="tagline">让表达，自然而然。</span>
                )}
              </div>
            </div>
            <div className="toolbar-actions">
              <span className={`status-dot ${paused ? "paused" : ""}`} />
              {!expanded && (
                <span className="compact-status">
                  {paused
                    ? "已暂停"
                    : source === "demo"
                      ? "演示模式"
                      : "眼动输入"}
                </span>
              )}
              {button(
                paused ? "resume-toolbar" : "pause",
                <Icon name={paused ? "play" : "pause"} />,
                paused ? "resume" : "pause",
                undefined,
                {
                  "aria-label": paused ? "恢复输入" : "暂停输入",
                  title: paused ? "恢复输入" : "暂停输入",
                },
              )}
              {expanded &&
                button(
                  "settings",
                  <Icon name="settings" />,
                  "settings",
                  undefined,
                  { "aria-label": "设置" },
                )}
              {button(
                expanded ? "collapse" : "expand",
                <Icon name="chevron" />,
                expanded ? "collapse" : "expand",
                undefined,
                {
                  "aria-label": expanded ? "收起窗口" : "展开窗口",
                  className: `expand-button ${expanded ? "" : "flipped"}`,
                },
              )}
            </div>
          </header>
          {expanded && (
            <>
              <nav className="modebar">
                <div className="segmented">
                  {button("write-mode", <>表达</>, "write", undefined, {
                    "aria-pressed": mode === "write",
                  })}
                  {button("desktop-mode", <>桌面</>, "desktop", undefined, {
                    "aria-pressed": mode === "desktop",
                  })}
                </div>
                <span className="source-label">
                  {source === "demo"
                    ? "◌ 演示输入"
                    : cameraReady
                      ? "● 本地摄像头"
                      : "摄像头启动中"}
                  <span className="divider">/</span>
                  {cloud && info.jevAvailable ? "Jev 已启用" : "本地决策"}
                </span>
              </nav>
              {paused ? (
                <section className="rest-view">
                  <span className="rest-symbol">Ⅱ</span>
                  <h2>休息一下。</h2>
                  <p>文字会留在这里。准备好后，注视下方按钮一秒。</p>
                  {button("resume", "继续表达", "resume", undefined, {
                    className: "primary large",
                  })}
                </section>
              ) : confirm ? (
                <section className="confirm-view">
                  <span className="eyebrow">确认操作</span>
                  <h2>{confirm.label}</h2>
                  <p>看向“确认”并再次主动眨眼，或者取消。</p>
                  <div>
                    {button("confirm", "确认", "confirm", undefined, {
                      className: "primary large",
                    })}
                    {button("cancel", "取消", "cancel", undefined, {
                      className: "large",
                    })}
                  </div>
                </section>
              ) : settings ? (
                <section className="settings-view">
                  <div className="settings-top">
                    <h2>按你的节奏。</h2>
                    <span>初次设置可由照护者协助</span>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>输入来源</strong>
                      <small>摄像头画面只在本机处理</small>
                    </div>
                    <div className="setting-buttons">
                      {button("demo", "演示", "demo", undefined, {
                        "aria-pressed": source === "demo",
                      })}
                      {button(
                        "camera",
                        cameraStarting ? "启动中…" : "开启摄像头",
                        "camera",
                        undefined,
                        { disabled: cameraStarting },
                      )}
                      {button("calibrate", "校准视线", "calibrate", undefined, {
                        disabled: !cameraReady,
                      })}
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>主动眨眼</strong>
                      <small>
                        {blink.minMs}–{blink.maxMs} ms · 长闭眼暂停
                      </small>
                    </div>
                    <button
                      disabled={!cameraReady || !!blinkTraining}
                      onClick={() => {
                        trainRef.current = {
                          phase: "natural",
                          started: performance.now(),
                          openValues: [],
                          durations: [],
                          closeAt: null,
                          natural: [],
                        };
                        setBlinkTraining("natural");
                      }}
                    >
                      校准眨眼
                    </button>
                  </div>
                  {blinkTraining ? (
                    <div className="training-message">
                      {blinkTraining === "natural"
                        ? "自然阅读，让眼睛正常眨动。"
                        : "现在有意慢眨眼 3–4 次。"}
                      <progress value={trainingProgress} max={1} />
                    </div>
                  ) : (
                    <div className="slider-row">
                      <label>
                        最短确认时间
                        <input
                          aria-label="最短眨眼确认时间"
                          type="range"
                          min="200"
                          max="700"
                          step="25"
                          value={blink.minMs}
                          onChange={(e) =>
                            setBlink((v) => ({
                              ...v,
                              minMs: +e.target.value,
                              maxMs: Math.max(v.maxMs, +e.target.value + 150),
                            }))
                          }
                        />
                      </label>
                      <label>
                        闭眼阈值
                        <input
                          aria-label="闭眼识别阈值"
                          type="range"
                          min="0.04"
                          max="0.22"
                          step="0.01"
                          value={eyeThreshold}
                          onChange={(e) => setEyeThreshold(+e.target.value)}
                        />
                        <small>当前眼部开合：{openLevel.toFixed(2)}</small>
                      </label>
                    </div>
                  )}
                  <div className="setting-row">
                    <div>
                      <strong>大键盘</strong>
                      <small>先选一组字母，再选具体字母</small>
                    </div>
                    <button
                      role="switch"
                      aria-checked={grouped}
                      onClick={() => {
                        setGrouped((v) => !v);
                        setGroup(null);
                      }}
                    >
                      {grouped ? "已开启" : "开启"}
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Jev 辅助选择</strong>
                      <small>
                        {info.jevAvailable
                          ? "开启后，仅发送附近候选和末尾 160 字文字"
                          : "桌面版配置 TYPESAFE_API_KEY 后可开启"}
                      </small>
                    </div>
                    <button
                      role="switch"
                      aria-checked={cloud}
                      disabled={!info.jevAvailable}
                      onClick={() => {
                        setCloud((v) => !v);
                        setDecision(null);
                      }}
                    >
                      {cloud ? "已开启" : "开启"}
                    </button>
                  </div>
                </section>
              ) : mode === "write" ? (
                <section className="write-view">
                  <div className="message-box">
                    <span className="eyebrow">我想说</span>
                    <div className="message-text" aria-live="polite">
                      {text || (
                        <span className="placeholder">从一个字母开始。</span>
                      )}
                      <span className="caret" />
                    </div>
                    <div className="message-actions">
                      {button("clear", <>清空</>, "clear")}
                      {button(
                        "speak",
                        <>
                          <Icon name="speak" />
                          朗读
                        </>,
                        "speak",
                        undefined,
                        { className: "speak-button", disabled: !text },
                      )}
                    </div>
                  </div>
                  <div className="suggestion-row">
                    {suggestions.length
                      ? suggestions.map((w) =>
                          button(`word-${w}`, w, "word", w),
                        )
                      : phrases
                          .slice(0, 3)
                          .map((p, i) => button(`phrase-${i}`, p, "phrase", p))}
                  </div>
                  <div
                    className={`keyboard ${grouped ? "grouped" : ""}`}
                    aria-label="屏幕键盘"
                  >
                    {grouped ? (
                      <div className="key-row">
                        {group
                          ? Array.from(group.toLowerCase()).map((k, i) =>
                              button(
                                `letter-${i}`,
                                k === " " ? "空格" : k,
                                "key",
                                k,
                              ),
                            )
                          : groups.map((g) =>
                              button(`group-${g}`, g, "group", g),
                            )}
                      </div>
                    ) : (
                      rows.map((row) => (
                        <div className="key-row" key={row}>
                          {Array.from(row).map((k) =>
                            button(`key-${k}`, k.toUpperCase(), "key", k),
                          )}
                        </div>
                      ))
                    )}
                    <div className="key-row bottom-row">
                      {grouped && group
                        ? button("groups", "返回字母组", "groups")
                        : button("period", ".", "key", ".")}
                      {button("space", "空格", "key", " ", {
                        className: "space-key",
                      })}
                      {button(
                        "backspace",
                        <>
                          <Icon name="back" />
                          <span>删除</span>
                        </>,
                        "backspace",
                        undefined,
                        { "aria-label": "删除一个字" },
                      )}
                    </div>
                  </div>
                  <div className="quick-phrases">
                    {phrases
                      .slice(3)
                      .map((p, i) => button(`quick-${i}`, p, "phrase", p))}
                  </div>
                </section>
              ) : (
                <section className="desktop-view">
                  <div className="desktop-heading">
                    <div>
                      <span className="eyebrow">你的电脑，你来决定</span>
                      <h2>{snapshot?.title || "选择一个窗口。"}</h2>
                    </div>
                    <Icon name="monitor" />
                  </div>
                  <p className="desktop-hint">
                    开启后切换到目标窗口，再读取按钮。每次操作都会显示确认。
                  </p>
                  <div className="desktop-tools">
                    {button(
                      "native",
                      native ? "关闭桌面控制" : "开启桌面控制",
                      "native",
                      undefined,
                      { disabled: !info.nativeSupported, className: "primary" },
                    )}
                    {button("refresh", "读取窗口", "refresh", undefined, {
                      disabled: !native,
                    })}
                    {button("insert", "输入当前文字", "insert", undefined, {
                      disabled: !snapshot || !text,
                    })}
                  </div>
                  {!info.nativeSupported && (
                    <div className="notice">
                      浏览器版提供交互预览。实际桌面操作支持 Windows 单显示器。
                    </div>
                  )}
                  <div className="desktop-targets">
                    {snapshot?.targets
                      .slice(desktopPage * 6, desktopPage * 6 + 6)
                      .map((t) => (
                        <button
                          key={t.id}
                          data-gaze={`native-${t.id}`}
                          data-action="native-target"
                          data-value={t.id}
                          className={
                            selected === `native-${t.id}` ? "selected" : ""
                          }
                          onClick={() =>
                            void execute("click", t.id, `点击「${t.label}」`)
                          }
                        >
                          {t.label || "未命名按钮"}
                        </button>
                      ))}
                  </div>
                  {snapshot && snapshot.targets.length > 6 && (
                    <div className="desktop-pagination">
                      {button("page-prev", "上一页", "page-prev", undefined, {
                        disabled: desktopPage === 0,
                      })}
                      <span>
                        {desktopPage + 1} /{" "}
                        {Math.ceil(snapshot.targets.length / 6)}
                      </span>
                      {button("page-next", "下一页", "page-next", undefined, {
                        disabled:
                          (desktopPage + 1) * 6 >= snapshot.targets.length,
                      })}
                    </div>
                  )}
                  <div className="desktop-scroll">
                    {button("scrollUp", "↑ 向上滚动", "scrollUp", undefined, {
                      disabled: !snapshot,
                    })}
                    {button(
                      "scrollDown",
                      "↓ 向下滚动",
                      "scrollDown",
                      undefined,
                      { disabled: !snapshot },
                    )}
                  </div>
                </section>
              )}
              <footer>
                <div className="feedback">
                  <span
                    className={`feedback-light ${closed ? "closed" : ""}`}
                  />
                  <span role="status">{status}</span>
                </div>
                <span className="counter">{sampleCount} 次确认</span>
              </footer>
            </>
          )}
        </main>
      )}
      {gaze && !calRun && !paused && (
        <div
          className={`gaze-cursor ${closed ? "closing" : ""}`}
          style={{ left: gaze.x, top: gaze.y }}
        />
      )}
      {!info.desktop && (
        <div className="preview-bottom">
          <span>看向目标。主动眨眼。保持自己的表达。</span>
          <span>
            PREVIEW 0.1 · <kbd>Space</kbd> 模拟眨眼 · <kbd>Esc</kbd> 暂停
          </span>
        </div>
      )}
    </div>
  );
}
