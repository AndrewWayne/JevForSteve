import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("steve", {
  info: () => ipcRenderer.invoke("info"),
  resize: (mode: string) => ipcRenderer.invoke("resize", mode),
  decide: (context: unknown) => ipcRenderer.invoke("decide", context),
  snapshot: () => ipcRenderer.invoke("snapshot"),
  execute: (request: unknown) => ipcRenderer.invoke("execute", request),
  enableNative: (enabled: boolean) =>
    ipcRenderer.invoke("native-enabled", enabled),
  quit: () => ipcRenderer.send("quit"),
  onPause: (callback: () => void) => {
    ipcRenderer.on("pause", callback);
    return () => ipcRenderer.removeListener("pause", callback);
  },
});
