import { mkdir, copyFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("public/wasm", { recursive: true });
await mkdir("public/models", { recursive: true });
for (const f of await readdir("node_modules/@mediapipe/tasks-vision/wasm"))
  if (/\.(wasm|js)$/.test(f))
    await copyFile(
      `node_modules/@mediapipe/tasks-vision/wasm/${f}`,
      `public/wasm/${f}`,
    );
const url =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const r = await fetch(url);
if (!r.ok) throw new Error(`Model download failed: ${r.status}`);
const bytes = Buffer.from(await r.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
const expected =
  "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";
if (sha256 !== expected)
  throw new Error(
    `Unexpected model checksum: ${sha256}. Review the official model version before updating the pin.`,
  );
await writeFile("public/models/face_landmarker.task", bytes);
console.log(
  `Downloaded official MediaPipe model: ${bytes.length} bytes; SHA256 ${sha256}`,
);
console.log(
  "Camera assets are served locally. No video is sent to a model server.",
);
