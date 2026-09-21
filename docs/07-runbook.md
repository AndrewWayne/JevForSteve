# 运行与开发手册

## 浏览器交互预览

需要 Node.js 22.16+ 或 24+（建议 24 LTS），npm，Git。

```bash
git clone https://github.com/AndrewWayne/JevForSteve.git
cd JevForSteve
npm ci
npm run dev
```

打开终端显示的 localhost 地址。鼠标移动模拟视线，停在目标上片刻，按住空格 0.35–0.85 秒后松开模拟主动眨眼；也可直接点击操作。Esc 暂停。演示不会操作其他程序，也不会联网调用 Jev。

## 本地摄像头

```bash
npm run assets
npm run dev
```

设置 → 开启摄像头 → 允许摄像头 → 校准视线。首次运行下载官方 face_landmarker 模型，并将已锁定 npm 包的 WASM 复制到本地静态目录。后续视觉推理不依赖模型 CDN。启动下载失败时不要用未知来源权重替换。

浏览器摄像头通常需要 localhost 或 HTTPS。原型不是后台录制工具：切换演示和关闭应用会停止视频轨道。不上传视频。不保证您的摄像头校准通过；失败时可检查反光、脸部遮挡和姿势，之后按评测方案比较另一模型/设备。

## Windows 桌面模式

```bash
npm run assets
npm run desktop
```

当前实验桥针对 Windows 单显示器。首次使用先在记事本或空白测试页面中检查。

1. 先完成相机校准；演示 Space 按键在非聚焦窗口中不能作为真实全局选择开关。
2. 切到“桌面”，开启桌面控制；面板变为不抢焦点窗口。
3. 激活目标应用及输入框，再在面板选择“读取窗口”。初版仍可能需要照护者协助激活目标窗口。
4. 选择面板中的按钮，随后确认。文字注入只向已绑定的可编辑焦点执行。快照 12 秒到期，操作后要重新读取。
5. `Ctrl+Shift+Space` 是全局暂停；暂停会关闭桌面控制。面板上的暂停和 Esc 也可停止当前会话操作。

Windows PowerShell 执行策略可能不允许本地 helper；项目不通过 `ExecutionPolicy Bypass` 绕过策略。出现此情况按设备管理规则签名/允许项目脚本，或等待后续签名 helper。不要把系统策略变化写成自动安装动作。

## 可选 Jev

复制 `.env.example` 为 `.env`，只填写自己的开发 key，不要提交该文件。

```dotenv
TYPESAFE_API_KEY=your_key_here
TYPESAFE_MODEL=jev-latest
```

重启桌面程序，在设置开启 Jev 辅助。没有 key 仍可使用本地输入。不要使用 `VITE_` 前缀保存 key，它会进入浏览器 bundle。

```bash
npm run jev:smoke -- --dry-run
npm run jev:smoke
```

第一条只显示合成请求；第二条会调用真实服务并消耗账户额度，只使用内置合成上下文。当前仓库交付没有执行真实付费 API 调用；响应合同以官方文档核对，在线准确率尚未验证。

模型别名会变化。正式对照实验应使用账户可用的具体版本，记录返回模型 ID、prompt 版本与数据集版本；不能把两个时期的 jev-latest 视为同一模型。

## 验证与打包

```bash
npm run check
npm run evaluate -- fixtures/evaluation.synthetic.jsonl
npm run dist:win
```

Windows 打包在 Windows 主机上完成，输出 `release/`。应先下载 assets；缺失模型时安装包无法追踪。当前没有签名安装包发布，也没有在 Linux 上声称验证了 Windows 注入。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 摄像头启动失败 | 检查权限、独占占用、模型/wasm 是否已下载；先关闭其他摄像头软件 |
| 校准反复不通过 | 记录条件而非无限重试；测试更大目标、B 路线或专用设备 |
| 眨眼不提交 | 先稳定预选，再按个人时长；检查是否自然/主动分布重叠 |
| Jev 没有动作 | 单字母和明确几何命中本来不调用；词候选有歧义才尝试；断网会退回本地 |
| 目标已过期 | 重新读取当前窗口，不自动重试旧点击 |
| 输入到了错误焦点的风险 | 初版限制绑定编辑控件；仍须 Windows 实机验证，暂不用于重要应用 |
| 中文打不出自由文字 | 当前只有中文短语；完整拼音候选在下一阶段 |

新增真实验证记录请写设备、操作步骤、期望、实际结果和版本；不要提交含患者姓名、脸图、原文或凭据的附件。
