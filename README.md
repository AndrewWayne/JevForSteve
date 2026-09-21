# JevForSteve

**看向目标，主动眨眼，保持自己的表达。**

面向 ALS 等运动障碍使用场景的眼动输入与桌面伴侣研究原型。普通摄像头在本地处理；Jev 仅对有限文本候选提供可关闭的语义辅助。界面是可收起的悬浮窗，展开后用于表达、朗读与有限桌面操作。

> **当前状态：工程原型。** 架构与验证路径已明确；尚未完成真实摄像头精度测试、ALS 用户试用、Windows 实机验收或 Jev 在线收益评估。能运行的代码不等于已适合患者独立日常使用。

## 先读技术路线

如果只读一份文档，请读 [技术路线决策](docs/00-route-decision.md)：**哪些已经确定，哪些只是暂定，怎样用实验作出最终选择。**

推荐路线是：本地眼部特征/视线模型 → 九点个人屏幕校准 → 独立位置验证 → 分组大目标 → 眨眼确认 → 本地执行。MediaPipe + 岭回归是已实现的可替换基线；预训练视线模型是下一轮配对实验对象，尚未集成。Jev 不接收视频，不承担眨眼判断，不替用户授权或静默改字。

| 文档 | 内容 |
| --- | --- |
| [00 路线决策](docs/00-route-decision.md) | 确定项、候选模型、取舍、关键实验 |
| [01 调研证据](docs/01-research.md) | 商用方案、摄像头模型、眨眼、Jev、来源链接 |
| [02 PRD](docs/02-prd.md) | 用户任务、产品范围、优先级、成功标准 |
| [03 架构](docs/03-architecture.md) | 模块、坐标、时序、本地/云、原生边界 |
| [04 交互与 Jev](docs/04-interaction-and-jev.md) | 状态机、谁决定什么、请求合同、弃权与过期 |
| [05 校准与评估](docs/05-calibration-and-evaluation.md) | 实验协议、指标、门槛、匿名数据格式 |
| [06 开发步骤](docs/06-development-plan.md) | 下一阶段按文件拆解的工作与验收 |
| [07 运行手册](docs/07-runbook.md) | 开发、摄像头、Windows、可选 API 配置 |
| [08 验证状态](docs/08-validation-status.md) | 已验证与未验证能力，逐项说明 |

## 快速运行

Node.js 22.16+ / 24+，建议使用 24 LTS。

```bash
npm ci
npm run dev
```

浏览器中移动鼠标模拟视线，稳定预选后按住空格 0.35–0.85 秒，再松开模拟主动眨眼。Esc 暂停，也可用鼠标点击体验。浏览器版不能操作其他程序。

开启真实摄像头前下载本地模型：

```bash
npm run assets
npm run desktop
```

在设置里开启摄像头、校准视线与主动眨眼。实际桌面控制的实验桥针对 **Windows 单显示器**；浏览器/macOS/Linux 没有原生控制能力。`Ctrl+Shift+Space` 为桌面版全局暂停。

## 初版实现

- React / TypeScript / Electron 悬浮窗、收起展开、表达与桌面模式。
- 本地 MediaPipe 特征、九点岭回归映射、五个独立验证位置；验证失败不激活眼动输入。
- 主动眨眼预选冻结、稳定时间、去重、长闭眼暂停、追踪中断后重新预选。
- 英文屏幕键盘/分组大键、演示词候选、中文固定短语和系统朗读。
- Jev 请求构造、有限 Choice/可选 Noul 合同、响应校验、超时及异步过期保护。
- Windows UI Automation 按钮面板、语义滚动和绑定编辑焦点的文字注入桥；操作前再次确认。
- 核心测试、匿名 JSONL 评估脚本、Linux/Windows CI 配置。

**没有实现**：完整中文拼音引擎、系统级 IME/TSF、任意像素鼠标、多屏、macOS 原生控制、完整驻留/开关后备、配置持久化和患者适用性验证。小工具栏目标仍需后续大目标替代路径。

## 可选 Jev

复制 `.env.example` 为 `.env`，填写 `TYPESAFE_API_KEY`，启动桌面版后在设置开启。默认关闭；文字候选有歧义时才请求，不逐帧调用，不对单个字母自动纠错。视频留在本机；开启后少量候选标签和最后最多 160 字上下文会发送给 TypeSafe。

```bash
npm run jev:smoke -- --dry-run  # 合成请求，不联网
npm run jev:smoke              # 配置 key 后的真实调用，可能产生费用
```

TypeSafe skill 已按官方 `npx skills add typesafe-ai/skills --skill typesafe-ai --agent codex -y` 路径安装；保留上游 skill、许可证和 lock 文件。本项目使用其“代码做计算与约束，模型做有限语义判断”的原则。

## 验证

```bash
npm run check
npm run evaluate -- fixtures/evaluation.synthetic.jsonl
```

合成 fixture 只用于验证合同、时序与指标计算，不是用户测试数据。真实设备验证清单见 [评估协议](docs/05-calibration-and-evaluation.md)。Windows 安装包在 Windows 主机运行 `npm run assets` 后用 `npm run dist:win` 构建，尚未发布签名安装包。

项目代码 MIT。外部模型、依赖与上游 skill 保留各自授权，见 [THIRD_PARTY.md](THIRD_PARTY.md)。
