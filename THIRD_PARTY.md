# Third-party components and research references

The project MIT license covers original project code and documents. It does not relicense dependencies, pretrained model weights, or the installed upstream skill.

| Component | Use | License / distribution note |
| --- | --- | --- |
| React / React DOM | Renderer | MIT; resolved versions in package-lock.json |
| Electron | Desktop host | MIT plus bundled Chromium/Node notices; retain packaged notices |
| MediaPipe Tasks Vision | Local landmark inference | Apache-2.0 package; keep upstream notices |
| Face Landmarker task | Downloaded from the official versioned MediaPipe model URL | Binary is not committed; verify the upstream model terms and include required notices before distributing installers |
| TypeSafe skill | Development instructions, unmodified upstream files | MIT; its LICENSE remains beside SKILL.md |
| TypeSafe API | Optional hosted inference | Service account/terms, not part of this repository's MIT grant |

`scripts/setup-assets.mjs` copies WASM from the locked package and downloads the version-1 face landmarker model. The observed SHA-256 is pinned in that script. A checksum confirms the artifact version, not user suitability or model licensing.

Research-only comparisons (not linked or copied into the app): WebGazer (GPLv3), OptiKey (GPLv3), GazeFollower (CC BY-NC-SA 4.0 per author README; larger model has additional access restrictions), L2CS-Net (MIT code; check weights separately), OpenVINO model zoo, and librime (BSD-3-Clause core; wrappers/dictionaries may differ).

Review package and model notices when producing a distributable. The current repository publishes source and documentation; it does not publish model weights or a signed installer.
