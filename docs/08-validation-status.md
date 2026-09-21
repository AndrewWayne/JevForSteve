# 实现与验证状态

日期：2026-09-21。此表随真实验证更新，不以计划冒充已完成。

| 项目 | 状态 | 证据/限制 |
| --- | --- | --- |
| 一手资料调研与路线取舍 | 已完成本轮 | `00-route-decision.md` 与 `01-research.md`；不代表设备试验完成 |
| TypeSafe skill | 已安装并采用 | `.agents/skills/typesafe-ai` 与 `skills-lock.json` |
| 公共 GitHub 仓库 | 已创建 | AndrewWayne/JevForSteve |
| 核心自动化测试 | 已通过 44 项；Linux/Windows CI 均成功 | 校准、眨眼、候选、Jev 合同/过期、事件评估 |
| TypeScript 与生产构建 | 本地 Node 24.19.0 + Linux/Windows CI 通过 | renderer + Electron 编译 |
| 浏览器界面检查 | 未完成 | 当前云浏览器禁止打开本地应用地址；没有伪造界面截图或声称完成实测 |
| 模型 assets 下载 | 已完成 | 官方模型 3,758,596 bytes；SHA-256 已固定在下载脚本 |
| 摄像头视线精度 | 未验证 | 当前环境无实际用户相机/注视标签 |
| 主动眨眼真人可靠性 | 未验证 | 模拟时序测试不是自然/主动分类实验 |
| Windows helper 语法 | Windows CI 通过 | 只解析脚本，不执行桌面动作 |
| Windows UIA/文字/滚动 | 代码实现，未实机验收 | CI 不代表交互式桌面验收 |
| Windows 安装包 | 未构建/未签名 | 需目标平台打包与验收 |
| Jev 合成请求 dry-run | 已通过 | 不联网；fixture 明确标为 synthetic |
| 匿名事件评估脚本 | 已通过合成样例 | 包含弃权和错误，不将其计为真人证据 |
| Jev 在线调用 | 未执行 | 未配置用户 API key；不能声明已测模型准确率 |
| Jev 中英增益 | 未验证 | 有合同与实验协议，没有真人对照数据 |
| ALS 用户试用 | 未开展 | 没有患者适用性结论 |

## 当前有意保留的范围

- 普通摄像头基线可能无法通过校准；不要通过降低门槛让演示“看上去成功”。
- 桌面目标展示在悬浮面板中，不是直接看原窗口任何像素就能点击。
- 固定中文短语不是中文输入引擎；英文词表也是演示规模。
- 相机推理尚未移出渲染线程；没有声明实测 FPS 或延迟。
- 配置/文字目前仅在会话中保留，退出后不恢复。
- 未实现完整驻留、开关扫描、漂移监测、全屏放大镜、多屏和 macOS/Linux 原生控制。
- 工具栏等小目标仍需后续自适应大目标路径；大字母组通过不代表全 UI 能独立眼控。

这些限制决定下一轮研发的优先级，具体见 `06-development-plan.md`。

## 本轮构建证据

[GitHub Actions Check #1](https://github.com/AndrewWayne/JevForSteve/actions/runs/35616824107)：提交 `fb6f100a938a9b6e615255f2fbc16b946659196a`，`core-and-build (ubuntu-latest)` 与 `core-and-build (windows-latest)` 均为 success。Windows 额外通过 PowerShell 语法解析。本次仅更新验证记录，没有改动经过测试的代码。
