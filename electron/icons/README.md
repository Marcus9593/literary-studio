# 应用图标

需要一个 `icon.icns` 文件用于 macOS 应用图标。

## 如何创建

1. 准备一个 1024x1024 像素的 PNG 图标
2. 使用以下方法之一转换为 .icns：

### 方法 A：使用 iconutil（macOS 自带）

```bash
# 创建 icon.iconset 目录
mkdir -p icon.iconset

# 用 sips 生成不同尺寸
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# 生成 icns
iconutil -c icns icon.iconset -o icon.icns

# 清理
rm -rf icon.iconset
```

### 方法 B：使用 electron-icon-builder

```bash
npx electron-icon-builder --input=icon.png --output=./
```

## 临时方案

如果不提供 icon.icns，Electron 会使用默认图标。功能不受影响，只是外观不同。
