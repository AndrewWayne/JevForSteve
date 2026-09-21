import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  session,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { requestDecision } from "../src/core/jev.js";
import type {
  DecisionContext,
  DesktopSnapshot,
  Target,
} from "../src/core/types.js";
try {
  process.loadEnvFile(path.resolve(".env"));
} catch {
  /* Environment variables are optional. */
}
const here = path.dirname(fileURLToPath(import.meta.url));
let win: BrowserWindow;
let nativeEnabled = false;
let cached: DesktopSnapshot | null = null;
let busy = false,
  lastDecision = 0;
let worker: ReturnType<typeof spawn> | null = null;
let serial = 0;
const pending = new Map<
  number,
  {
    resolve: (value: any) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
function native(command: Record<string, unknown>): Promise<any> {
  if (process.platform !== "win32")
    return Promise.reject(new Error("当前仅 Windows 支持桌面控制"));
  if (!worker) {
    const script = app.isPackaged
      ? path.join(process.resourcesPath, "windows.ps1")
      : path.resolve("native/windows.ps1");
    worker = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-File", script],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    createInterface({ input: worker.stdout! }).on("line", (line) => {
      try {
        const r = JSON.parse(line);
        const p = pending.get(r.id);
        if (p) {
          clearTimeout(p.timer);
          pending.delete(r.id);
          r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
        }
      } catch {
        /* Ignore non-protocol output. */
      }
    });
    const fail = () => {
      worker = null;
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("Windows 辅助进程已停止"));
      }
      pending.clear();
      nativeEnabled = false;
    };
    worker.on("exit", fail);
    worker.on("error", fail);
    worker.stderr?.on("data", () => {
      /* Drain helper diagnostics without exposing window text. */
    });
  }
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Windows 操作超时"));
    }, 3500);
    pending.set(id, { resolve, reject, timer });
    worker!.stdin!.write(JSON.stringify({ ...command, id }) + "\n");
  });
}
function checkSender(e: Electron.IpcMainInvokeEvent) {
  if (
    e.sender !== win.webContents ||
    e.senderFrame !== win.webContents.mainFrame
  )
    throw new Error("Invalid sender");
}
app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay(),
    w = d.workArea;
  win = new BrowserWindow({
    width: 820,
    height: 660,
    x: w.x + w.width - 844,
    y: w.y + w.height - 684,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) =>
      callback(
        webContents === win.webContents &&
          permission === "media" &&
          "mediaTypes" in details &&
          (details.mediaTypes ?? []).includes("video") &&
          !(details.mediaTypes ?? []).includes("audio"),
      ),
  );
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.argv.includes("--dev")) void win.loadURL("http://127.0.0.1:5173");
  else void win.loadFile(path.resolve(here, "../../dist/index.html"));
  ipcMain.handle("info", (e) => {
    checkSender(e);
    return {
      desktop: true,
      platform: process.platform,
      jevAvailable: !!process.env.TYPESAFE_API_KEY,
      display: screen.getPrimaryDisplay().bounds,
      bounds: win.getBounds(),
      nativeSupported:
        process.platform === "win32" && screen.getAllDisplays().length === 1,
    };
  });
  ipcMain.handle("resize", (e, mode) => {
    checkSender(e);
    if (!["compact", "expanded", "calibration"].includes(mode)) return;
    const display = screen.getPrimaryDisplay();
    if (mode === "calibration") {
      win.setBounds(display.bounds);
      win.setFocusable(true);
    } else {
      const width = mode === "compact" ? 390 : 820,
        height = mode === "compact" ? 90 : 660;
      win.setBounds({
        x: display.workArea.x + display.workArea.width - width - 24,
        y: display.workArea.y + display.workArea.height - height - 24,
        width,
        height,
      });
      win.setFocusable(!nativeEnabled);
    }
  });
  ipcMain.handle("decide", async (e, c: DecisionContext) => {
    checkSender(e);
    if (busy || Date.now() - lastDecision < 650)
      throw new Error("Jev decision throttled");
    if (
      !c ||
      JSON.stringify(c).length > 6000 ||
      !Array.isArray(c.candidates) ||
      !["write", "desktop"].includes(c.mode) ||
      typeof c.prefix !== "string" ||
      typeof c.task !== "string"
    )
      throw new Error("Invalid decision context");
    busy = true;
    lastDecision = Date.now();
    try {
      return await requestDecision(
        c,
        process.env.TYPESAFE_API_KEY ?? "",
        process.env.TYPESAFE_MODEL ?? "jev-latest",
      );
    } finally {
      busy = false;
    }
  });
  ipcMain.handle("native-enabled", (e, enabled) => {
    checkSender(e);
    nativeEnabled =
      enabled === true &&
      process.platform === "win32" &&
      screen.getAllDisplays().length === 1;
    cached = null;
    win.setFocusable(!nativeEnabled);
  });
  ipcMain.handle("snapshot", async (e) => {
    checkSender(e);
    if (!nativeEnabled) throw new Error("请先开启桌面操作");
    const s = await native({ command: "snapshot", ignorePid: process.pid });
    const scale = screen.getPrimaryDisplay().scaleFactor;
    cached = {
      hwnd: String(s.hwnd),
      title: s.title,
      capturedAt: Date.now(),
      token: randomUUID(),
      targets: s.targets.map(
        (t: any): Target => ({
          id: t.id,
          nativeId: t.id,
          label: String(t.label).slice(0, 80),
          kind: "desktop",
          action: "click",
          rect: {
            x: t.x / scale,
            y: t.y / scale,
            width: t.width / scale,
            height: t.height / scale,
          },
        }),
      ),
    };
    return cached;
  });
  ipcMain.handle("execute", async (e, r) => {
    checkSender(e);
    if (
      !nativeEnabled ||
      !cached ||
      r?.token !== cached.token ||
      Date.now() - cached.capturedAt > 12000
    )
      return { ok: false, message: "目标已过期，请重新选择" };
    if (!["click", "scrollUp", "scrollDown", "text"].includes(r.action))
      throw new Error("Unsupported action");
    const t = cached.targets.find((t) => t.id === r.targetId);
    if (r.action === "click" && !t) throw new Error("Invalid target");
    if (
      r.action === "text" &&
      (typeof r.text !== "string" || r.text.length > 2000)
    )
      throw new Error("Invalid text");
    const snapshot = cached;
    cached = null;
    try {
      await native({
        command: "execute",
        hwnd: snapshot.hwnd,
        action: r.action,
        targetId: t?.id,
        text: r.action === "text" ? r.text : undefined,
      });
      return { ok: true, message: "操作已完成" };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  });
  ipcMain.on("quit", (e) => {
    if (e.sender === win.webContents) app.quit();
  });
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    nativeEnabled = false;
    cached = null;
    win.setFocusable(true);
    win.webContents.send("pause");
  });
});
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  worker?.kill();
});
