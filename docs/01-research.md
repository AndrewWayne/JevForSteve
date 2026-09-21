# 技术调研与证据边界

检索与核对：2026-09-21。优先使用官方文档、原作者仓库和研究论文。以下“本项目判断”是工程推断，未伪装成论文结论。

## 现有辅助沟通方案

商用眼动输入常使用近红外光源、眼部摄像头、瞳孔与角膜反射关系估计视线，经个人校准映射到屏幕。产品价值还包括姿势支持、目标大小、选择方式、纠错、词预测、语音输出与照护者配置，而不仅是坐标预测。Tobii 对 PCCR 有官方说明 [S4]。Grid 支持驻留、眨眼及开关等选择设置 [S5]：这说明“指向”与“确认”应拆成两个模块。

OptiKey 是值得研究的 Windows 辅助输入产品，覆盖键盘、鼠标和多种输入设备 [S6]。可选路线是直接基于它扩展；代价是适应其 .NET 产品架构及 GPL 授权。本项目为验证 Jev 合同和轻量悬浮交互而做独立实现，没有复制它的代码。如果目标改为尽快向用户提供成熟辅助功能，应重新比较扩展 OptiKey 与继续独立开发。

## 摄像头视线方案

| 证据 | 能支持什么 | 不能支持什么 |
| --- | --- | --- |
| MediaPipe Iris 官方说明 [S7] | 能定位虹膜/眼部，构造个人映射特征 | 不能直接得出“用户正在看哪里”；官方明确区分虹膜追踪和视线推断 |
| Face Landmarker 官方任务文档 [S8] | 本地视频人脸特征提取和接口实现依据 | 不能把 face detection confidence 当作屏幕视线准确率 |
| WebGazer 官方项目 [S9] | 浏览器 webcam 回归路线可行；提供研究与实现参考 | 不能推出所有笔记本都能准确选择密集键盘；维护与授权有约束 |
| GazeCapture/iTracker 原作者项目 [S10] | 外观模型 + 个体校准有研究基础 | 手机/平板厘米结果不是笔记本结果，更不是 ALS 使用结果 |
| L2CS-Net 官方实现 [S11] | 双轴视线方向网络、训练与推理参考，代码 MIT | yaw/pitch 不是屏幕坐标；下载权重的授权和性能还需单独确认 |
| OpenVINO 官方模型卡 [S12] | 轻量网络以左右眼和头角为输入，输出 3D 方向；适合做 CPU 候选 | 官方内部测试口径不能替代本项目外部设备测试 |
| GazeFollower 作者仓库/论文 [S13] | 包含 webcam 校准与采集流程，具有研究参考价值 | 不应忽略 NC/SA 条件，也不能把计划中的 blink 功能当作已具备 |
| 2024 屏幕映射研究 [S14] | 方向到屏幕还需要几何和个体补偿 | 示例和有限实验不保证跨人、跨姿势泛化 |

原作者 GazeCapture 项目报告：未校准手机/平板误差 1.7/2.5 cm，校准后 1.3/2.1 cm；应用场景、设备与采集过程不同 [S10]。OpenVINO 模型卡列出内部数据集的角度 MAE 6.95° [S12]。这里记录这些数字是为了说明**指标不可混用**，不是为 JevForSteve 预报误差。

本项目判断：A 路线（特征 + 岭回归）最快建立可测闭环；B 路线（预训练外观模型 + 个体映射）最值得做升级对照；专用眼动仪保留为失败后的输入替代。暂不从头训练大型视线网络，因为没有足够的真实注视标签、设备覆盖与用户样本。

## 眨眼与 ALS 适用性

自然眨眼、主动眨眼、疲劳性闭眼、检测丢失不能混为一谈。2017 年自然光眼动 + 主动眨眼研究展示了并行检测和文字输入可行性，但不能推广为所有 ALS 患者都适用 [S15]。医学文献区分主动闭眼与自发/反射性眨眼，并讨论了 ALS 中的相关异常 [S16]；因此“渐冻症总是能眨眼”不足以成为产品假设。

工程决定：阈值由个体样本得到；闭眼期间不更新指向；睁眼后只提交闭眼前已稳定显示的目标；长闭眼暂停。备用驻留/开关是后续必需项，初版不能宣称已经覆盖。

## Jev 的真实边界

TypeSafe 文档规定 Jev 接收文本 state；支持 Choice、Noul、Score。本文不把它当多模态模型或通用文本生成模型 [S1–S3]。Choice 的概率分布反映模型判断，不是用户真实意图概率；类型正确不能证明内容正确。官方模型行为文档提醒数值、指代和不可信内容等问题 [S17]，所以数值几何和权限不交给模型。

有价值的假设是：在眼动给出的少量词候选或已有明确任务的控件中，语义信号减少一次重试。没有价值的用法是每帧发送眼部坐标，让 Jev 充当滤波器；或在任意相邻字母间猜“用户其实想打哪个”。后者会伤害姓名、新词和否定表达。

SpeakFaster 的研究说明“减少选择次数”可能显著帮助眼动沟通，但其生成/缩写展开方法与 Jev 不是同一种模型，也不能将该研究收益转移给本项目 [S18]。

## 桌面和中文技术选择

Electron + React + TypeScript 有利于快速共享浏览器交互预览和桌面壳；代价是内存、安装体积与主线程视觉推理开销。Tauri 体积较小，但跨平台系统接口和 Rust 绑定增加第一轮工作；Windows .NET 更适合长期深度 UI Automation 集成。当前选择 Electron 不代表长期原生层必须使用脚本：PowerShell 是可替换实验桥，后续迁移签名 .NET helper。

Windows UI Automation 提供语义目标及 InvokePattern [S19]。SendInput 受完整性级别等限制 [S20]；本项目不绕过系统权限，不承诺所有程序、游戏、远程桌面、画布或提权窗口均可控制。第一版先做单屏，避免把多屏坐标、缩放和焦点问题同时引入。

中文采用“拼音键入 → 本地词典候选 → 大候选面板 → 眨眼选择”。librime 核心是候选路线，词典、封装、WASM 工程各有授权，必须分开核对 [S21]。当前代码只有英文键盘、少量英文补全和中文常用短语，不是完整中文输入法，也不是系统 TSF 插件。

## 来源

| 编号 | 一手来源 | 本次用途 |
| --- | --- | --- |
| S1 | [TypeSafe State](https://docs.typesafe.ai/concepts/state) | 文本输入、结构化上下文、语言边界 |
| S2 | [TypeSafe API](https://docs.typesafe.ai/api) | endpoint、请求与响应合同 |
| S3 | [TypeSafe Confidence](https://docs.typesafe.ai/confidence) | 概率及置信度解释 |
| S4 | [Tobii: how eye tracking works](https://www.tobii.com/blog/how-eye-tracking-works) | PCCR 技术原理 |
| S5 | [Smartbox Grid eye gaze settings](https://hub.thinksmartbox.com/knowledgebase/eye-gaze-settings-in-grid-3/) | 选择方式与实际产品设置 |
| S6 | [OptiKey](https://github.com/OptiKey/OptiKey) | 既有产品与复用路线 |
| S7 | [MediaPipe Iris](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md) | 虹膜定位和视线的区别 |
| S8 | [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) | 特征提取接口 |
| S9 | [WebGazer](https://webgazer.cs.brown.edu/) | 浏览器路线、维护、授权 |
| S10 | [GazeCapture](https://gazecapture.csail.mit.edu/) | 外观模型原始研究 |
| S11 | [L2CS-Net 作者实现](https://github.com/Ahmednull/L2CS-Net) | 方向估计候选模型 |
| S12 | [OpenVINO gaze-estimation-adas-0002](https://docs.openvino.ai/2023.3/omz_models_model_gaze_estimation_adas_0002.html) | 输入、输出及测试口径 |
| S13 | [GazeFollower 作者仓库](https://github.com/GanchengZhu/GazeFollower) / [论文 DOI](https://doi.org/10.1145/3729410) | webcam 系统及授权 |
| S14 | [Frontiers 2024: 1369566](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2024.1369566/full) | 视线到屏幕映射 |
| S15 | [IEEJ 2017: Eye-gaze input with voluntary blinks](https://www.jstage.jst.go.jp/article/ieejeiss/137/4/137_584/_article/-char/en) | 主动眨眼研究 |
| S16 | [Understanding Eyelid Closure Apraxia (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11093171/) | 主动闭眼能力不能一概而论 |
| S17 | [Jev 1.13 model behavior](https://docs.typesafe.ai/model-jaggedness/jev-1.13) | 已知模型局限 |
| S18 | [Google Research: SpeakFaster](https://research.google/pubs/using-large-language-models-to-accelerate-communication-for-eye-gaze-typing-users-with-als/) | 减少选择次数的研究方向 |
| S19 | [Microsoft UI Automation control patterns](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-controlpatternsoverview) | 原生语义操作 |
| S20 | [Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) | 注入输入与系统边界 |
| S21 | [librime](https://github.com/rime/librime) | 中文输入引擎候选 |
| S22 | [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) / [screen](https://www.electronjs.org/docs/latest/api/screen) | 悬浮窗与坐标接口 |
| S23 | [TypeSafe skill](https://github.com/typesafe-ai/skills/tree/main/skills/typesafe-ai) | Jev 工作流规范 |

未能阅读全文的来源不用于推导具体性能门槛；README 自称“accurate”等宣传表述也不作为本项目验收证据。
