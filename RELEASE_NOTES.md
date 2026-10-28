# v0.1.0 — 图片拖动 · Image Drag

首个公开版本：重点是 DeepSeek Harness 右侧边栏的**图片拖动**，并提供每个分栏自己的小关闭按钮；不修改任何原生行为。

## 新功能

- **Ctrl + 鼠标左键拖动平移（重点）**：图片 / PDF / Office→PDF 预览放大后，按住 Ctrl 拖动即可平移；直接驱动预览自身滚动，与「适应宽度」「25%–400% 固定缩放」「Ctrl + 滚轮缩放」兼容。
- **每个分栏的小关闭按钮**：单栏时提示「关闭全部」，双栏时左右各一个、提示「关闭本栏」；点击只清空本栏并留在本栏「开始」页，另一栏、分栏布局和侧边栏都保持不变。

## 安装

```powershell
dsh plugin --profile desktop add "github:YuyuYuu-wyt/dsh-image-drag"
```

或克隆后本地安装：

```powershell
git clone https://github.com/YuyuYuu-wyt/dsh-image-drag.git
cd dsh-image-drag
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile desktop
```

安装后刷新 DSH 页面（Ctrl+R）；如未生效，完全退出 DeepSeek Harness 后重开。

## 兼容性

- DeepSeek Harness `>= 0.2.0-rc.2`（在 `0.2.1-rc.2` 的 Windows 桌面端与 Web 端验证）。
- 纯浏览器侧插件：无 Host 行为、无网络请求、无额外权限、无持久化状态。

## 验证

独立验收（headless 浏览器 + 真实 CDP 鼠标事件，含不装插件的 baseline 对照）：15/15 项 PASS，0 console error / warning。

## 已知边界

- HTML 预览（沙箱 iframe）与文本 / 代码 / Markdown 预览不支持拖动。
- 触屏 / 触控板维持系统原生手势。
- 侧边栏完全收起且只剩浮动窗口时，顶部按钮不可见；关闭按钮作用于停靠分栏，浮动窗口保留原生 tab 关闭。

---

# v0.1.0 — Image Drag (English)

First public release: focused on **image dragging** in the DeepSeek Harness right sidebar, with one close button per pane; no native behaviour is changed.

- **Ctrl + left-drag panning (main feature)** for zoomed image / PDF / Office→PDF previews; it drives the preview's own scroll position and composes with fit-width, fixed 25%–400% zoom and Ctrl+wheel zoom.
- **One close button per pane**: "close all" on a single pane, "close this pane" on each side of a split sidebar. A click clears only that pane back to its Start page; the other pane, the split layout and the sidebar stay unchanged.

Install with `dsh plugin --profile desktop add "github:YuyuYuu-wyt/dsh-image-drag"`, or clone and run `install.ps1`. Refresh the DSH page (Ctrl+R) afterwards; restart DeepSeek Harness if the plugin still does not appear.

Verified on DSH `0.2.1-rc.2` (Windows desktop and web). Independent acceptance: 15/15 criteria PASS with a no-plugin baseline control and a clean console.
