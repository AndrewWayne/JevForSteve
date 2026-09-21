import type { HostBridge } from "./core/types";
declare global {
  interface Window {
    steve?: HostBridge;
  }
}
export const host: HostBridge = window.steve ?? {
  async info() {
    return {
      desktop: false,
      platform: "browser",
      jevAvailable: false,
      display: { x: 0, y: 0, width: innerWidth, height: innerHeight },
      bounds: { x: 0, y: 0, width: innerWidth, height: innerHeight },
      nativeSupported: false,
    };
  },
  async resize() {},
  async decide(c) {
    return {
      revision: c.revision,
      target: null,
      needsConfirmation: false,
      source: "local",
      reason: "浏览器预览：Jev 需在桌面版中启用",
    };
  },
  async snapshot() {
    return {
      hwnd: "",
      title: "浏览器预览",
      capturedAt: Date.now(),
      targets: [],
      token: "",
      error: "桌面操作请运行 Windows 桌面版",
    };
  },
  async execute() {
    return { ok: false, message: "浏览器预览不会操作电脑" };
  },
  async enableNative() {},
  quit() {},
  onPause() {
    return () => {};
  },
};
