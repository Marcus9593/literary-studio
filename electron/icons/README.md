# 应用图标

## 文件说明

| 文件 | 用途 |
|------|------|
| `icon-source.png` | 1024×1024 设计稿（可满画布，用于再生成） |
| `icon.icns` | macOS / DMG（已含 Dock 安全区内边距） |
| `icon.ico` | Windows 安装包 |
| `icon-dock-preview.png` | 本地预览（git 忽略，运行脚本后生成） |

## Dock 图标偏大？

macOS Dock 使用 squircle 遮罩。若设计稿占满 1024×1024 画布，安装后会比系统应用**视觉上大一圈**。

本仓库在生成 `icon.icns` 时自动将内容缩放到 **824/1024（约 80.5%）** 并居中，与 Apple Big Sur 图标网格一致。

## 重新生成

修改 `icon-source.png` 后执行：

```bash
python3 scripts/build-app-icon.py
# 或
npm run electron:icons
```

打包 DMG 时 `build-electron.mjs` 也会自动运行上述脚本。

## 从零创建 icon-source.png

1. 准备 1024×1024 PNG（「文」字 + 圆角背景即可，可满画布）
2. 保存为 `electron/icons/icon-source.png`
3. 运行 `npm run electron:icons`

脚本会输出带 Dock 安全区的 `icon.icns` / `icon.ico`，无需手动调 iconutil。
