# 图片拖动 · Image Drag

[English](README.en.md) | 中文

一个给 DeepSeek Harness（DSH）右侧边栏用的小插件，重点是**图片拖动**，不接管原生 UI：

- **Ctrl + 鼠标左键拖动**：平移放大的图片 / PDF 预览（含 Word/PPT 转 PDF）。
- **每个分栏的小关闭按钮**：双栏时左右各一个，点击只清空本栏并留在本栏的「开始」页。

| 视图 | 效果 |
| --- | --- |
| 单栏 | ![单栏：放大后的图片被 Ctrl+拖动平移](docs/screenshot.png) |
| 双栏 | ![双栏：左右各一个小关闭按钮](docs/split.png) |

在「插件 → 已安装插件」里显示为 **图片拖动**：

![插件列表中的显示名与图标](docs/plugin-list.png)

## 功能

### 1. Ctrl + 左键拖动平移预览

在右侧边栏打开图片、PDF 或 Office 文档（转换为 PDF）预览，用 `Ctrl + 滚轮` 或缩放控件放大到出现滚动条后，**按住 Ctrl 再按住鼠标左键拖动**即可平移画面。

- 拖动直接驱动预览自身的滚动位置（`scrollLeft` / `scrollTop`），与「适应宽度」「25%–400% 固定缩放」「Ctrl + 滚轮缩放」完全兼容，不替换图片的 Blob URL，也不影响 PDF 的矢量与文本层。
- 按住 Ctrl 悬停时光标变为「抓手」，拖动中变为「抓取」。
- 只按左键拖动仍是原生行为（PDF 选字不受影响）；拖动结束会吞掉落在预览画面上的那一次 click，避免误触 PDF 链接，其它区域的点击不受影响。

### 2. 每个分栏的小关闭按钮

右侧边栏每个停靠分栏的标签栏都有一个「关闭」按钮：

- **单栏**：提示「关闭全部」——清空本栏内容，留在「开始」页，侧边栏保持展开。
- **双栏**：左右两栏各有一个，提示「关闭本栏」——只清空本栏内容，另一栏、双栏布局和整个侧边栏都不变。
- 若该栏原本没有「开始」页，关闭时会自动补一个；两栏都清空后就是左右两个「开始」，再点无操作。
- 图标沿用原生图标按钮的尺寸与风格，悬停约 0.4 秒显示提示。

## 安装

要求：DeepSeek Harness `>= 0.2.0-rc.2`（在 `0.2.1-rc.2` 验证），带 `dsh` CLI。

### 方式 A：从 npm 安装

```powershell
dsh plugin --profile desktop add dsh-image-drag
```

### 方式 B：从 GitHub 安装

```powershell
dsh plugin --profile desktop add "github:YuyuYuu-wyt/dsh-image-drag"
```

### 方式 C：克隆后本地 link 安装

```powershell
git clone https://github.com/YuyuYuu-wyt/dsh-image-drag.git
cd dsh-image-drag
dsh plugin --profile desktop add "link:$PWD"
```

或直接用仓库里的脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile desktop
```

安装后刷新 DSH 页面（`Ctrl+R`）；若插件仍未出现，完全退出 DeepSeek Harness 再重新打开。

卸载：

```powershell
dsh plugin --profile desktop remove dsh-image-drag
```

## 实现

纯浏览器侧 DSH 插件，不修改任何 DSH 自带包，也没有 Host 侧行为：

- `lib/client.js`：以 `window.__ModuleLoader__` bundle 形式加载。平移挂原生预览已有的 `[data-document-zoom-scrollport]`；关闭按钮注入每个分栏的 tab 条，通过公开控制器 `ctx.sidebarRight` 先在该分栏内保证「开始」页存在，再关闭其余标签，因此不会触发「关掉最后一个标签就收起整列」的原生规则。
- `lib/index.js`：空的 Host 半（只为让 bundle 扫描到 `dsh.client`）。
- `locale/` + `icon.svg`：插件列表中的显示名、简介与图标。
- 无网络请求、无额外权限、无持久化状态。

## 已知边界

- HTML 预览走沙箱 iframe，没有共享缩放视口，不在拖动范围内；文本 / 代码 / Markdown 预览保持原样（避免干扰选字）。
- 触屏 / 触控板双指滚动仍走系统原生手势；本插件只处理 `Ctrl + 左键` 的鼠标手势。
- 右侧边栏完全收起、只剩浮动窗口时，顶部按钮不可见，需要先展开侧栏。
- 关闭按钮作用于停靠分栏；浮动窗口里仍用原生每个 tab 的关闭。

## 验证

独立验收（headless 浏览器 + 真实 CDP 鼠标事件驱动 DSH Web 实例，含「不装插件」的 baseline 对照）：**15/15 项 PASS**，覆盖双栏各自关闭、图片/PDF 平移、原生缩放不受影响、拖动后立即点击、无控制台错误；baseline 下原生 Ctrl+拖拽不平移，确认行为由本插件提供。

本项目由 AI 辅助编程完成。

## License

[MIT](LICENSE)
