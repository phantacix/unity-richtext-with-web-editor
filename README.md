# HTML-Unity-RichText

A lightweight, zero-dependency rich text editor that bridges HTML formatting with Unity-style markup syntax. Supports all **35 Unity rich text tags** with visual controls, live preview, and XSS protection.

![Demo](demo/demo.gif)
![Demo2](demo/demo2.png)

---

## Features

- **All 35 Unity Tags** — Complete support for every Unity rich text tag including formatting, transforms, fonts, spacing, colors, links, and special tags
- **Visual Toolbar** — Categorized toolbar with color pickers, dropdowns, number sliders, and text inputs for intuitive tag application
- **Live Preview** — Real-time HTML rendering as you type with XSS-safe output (HTML escaping before tag processing)
- **Keyboard Shortcuts** — Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
- **Zero Dependencies** — Single-file, vanilla JavaScript implementation
- **Responsive** — Works on both desktop and mobile browsers
- **Extensible** — Add custom tags, controls, and validators via the options API
- **Game-Ready** — Enables direct editing of in-game rich text content (emails, announcements, UI text, dialogue) within Unity environments

---

## Quick Start

```html
<script src="./html.unity.richtext.js"></script>
<script>
  const editor = new HURichTextEditor('#myTextarea', '#previewContainer');
</script>
```

That's it. The editor automatically creates a toolbar above the textarea and renders a live preview below it.

### With Options

```html
<script>
  const editor = new HURichTextEditor('#myTextarea', '#previewContainer', {
    color: {
      controlOptions: { default: '#00FF00' }
    },
    size: {
      controlOptions: { default: 18, min: 8, max: 72 }
    }
  });
</script>
```

---

## Complete Tag Reference

All 35 supported Unity rich text tags:

### Basic Formatting (4 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `b` | `<b>text</b>` | Bold text |
| `i` | `<i>text</i>` | Italic text |
| `u` | `<u>text</u>` | Underlined text |
| `s` | `<s>text</s>` | Strikethrough text |

### Text Transform (6 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `allcaps` | `<allcaps>text</allcaps>` | Force all uppercase |
| `uppercase` | `<uppercase>text</uppercase>` | Uppercase transform |
| `lowercase` | `<lowercase>text</lowercase>` | Force all lowercase |
| `smallcaps` | `<smallcaps>text</smallcaps>` | Small capitals |
| `sub` | `<sub>text</sub>` | Subscript |
| `sup` | `<sup>text</sup>` | Superscript |

### Font & Size (3 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `font` | `<font="name">text</font>` | Font family (e.g. `Impact SDF`, `Arial SDF`) |
| `font-weight` | `<font-weight="700">text</font-weight>` | Font weight (100–900) |
| `size` | `<size=24>text</size>` | Font size (supports `px`, `%`, `em` units) |

### Spacing & Layout (9 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `align` | `<align="center">text</align>` | Text alignment (`left`, `center`, `right`, `justified`, `flush`) |
| `cspace` | `<cspace=0.1em>text</cspace>` | Character spacing |
| `mspace` | `<mspace=2.75em>text</mspace>` | Monospace character width |
| `indent` | `<indent=15%>text</indent>` | Paragraph indentation |
| `line-height` | `<line-height=150%>text</line-height>` | Line height |
| `line-indent` | `<line-indent=10%>text</line-indent>` | First-line indentation |
| `margin` | `<margin=5em>text</margin>` | Left and right margin |
| `voffset` | `<voffset=0.5em>text</voffset>` | Vertical text offset |
| `width` | `<width=60%>text</width>` | Text block width |

### Colors & Effects (5 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `color` | `<color=#FF0000>text</color>` | Text color (hex or named) |
| `alpha` | `<alpha=#80>text</alpha>` | Text transparency (00–FF hex) |
| `mark` | `<mark=#FFFF00AA>text</mark>` | Highlight/background color with alpha |
| `gradient` | `<gradient="name">text</gradient>` | Gradient color preset |
| `style` | `<style="H1">text</style>` | Named style class reference |

### Links & Media (3 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `a` | `<a href="url">text</a>` | Web hyperlink |
| `link` | `<link="id">text</link>` | Game event link (triggers callback) |
| `sprite` | `<sprite name="assetName">` | Inline sprite/image (self-closing) |

### Special Tags (5 tags)

| Tag | Syntax | Description |
|-----|--------|-------------|
| `br` | `<br>` | Line break (self-closing) |
| `space` | `<space=5em>` | Horizontal space (self-closing) |
| `pos` | `<pos=75%>` | Absolute horizontal cursor position (self-closing) |
| `nobr` | `<nobr>text</nobr>` | Disable word wrapping |
| `noparse` | `<noparse>text</noparse>` | Disable rich text parsing within block |

---

## Visual Controls

The toolbar provides categorized visual controls for each tag type:

| Control Type | Used For | Description |
|-------------|----------|-------------|
| **Toggle Button** | `b`, `i`, `u`, `s`, transforms, `nobr`, `noparse` | Click to wrap/unwrap selected text. No popup needed. |
| **Color Picker** | `color` | Native color input + hex text field + 20 preset color swatches + named color support |
| **Alpha Slider** | `alpha` | Range slider (0–255) with hex display and checkerboard preview |
| **Mark Picker** | `mark` | Combined color picker + alpha slider with live highlight preview |
| **Number + Unit** | `size`, `cspace`, `mspace`, `indent`, `line-height`, etc. | Number input + unit dropdown (px/em/%) + range slider with min/max |
| **Dropdown** | `align`, `font-weight` | Select from predefined choices |
| **Text Input** | `font`, `gradient`, `style`, `a`, `link`, `sprite` | Free-form text input with placeholder and validation |

All value-based controls open a popup when their toolbar button is clicked. The popup can be applied with the **Enter** key or cancelled with **Escape**.

---

## API

### Constructor

```javascript
new HURichTextEditor(selector, previewSelector, options?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string` | CSS selector for the `<textarea>` element |
| `previewSelector` | `string` | CSS selector for the preview container `<div>`. If not found, one is created automatically. |
| `options` | `object` | Optional. Override tag configurations (see below). |

### Static Factory

```javascript
HURichTextEditor.create(selector, previewSelector, options?)
```

Identical to the constructor. Returns a new `HURichTextEditor` instance.

### Instance Methods

#### `editor.applyStyle(tagName, value?)`

Apply a tag programmatically. For toggle tags, pass no value. For value tags, pass the value string.

```javascript
editor.applyStyle('b');              // Toggle bold on selection
editor.applyStyle('color', '#FF0000'); // Apply red color to selection
editor.applyStyle('size', '24px');    // Apply 24px size
editor.applyStyle('br');             // Insert line break at cursor
```

#### `editor.clearAllFormat()`

Remove all Unity rich text tags from the textarea content (or from the selected text if there is a selection).

```javascript
editor.clearAllFormat();
```

#### `editor.updateOutput()`

Manually trigger a preview re-render. This is called automatically on every input event, but can be called manually if the textarea value is changed programmatically.

```javascript
editor.textarea.value = 'New <b>content</b>';
editor.updateOutput();
```

### Options Override

Pass an options object to customize any tag's configuration:

```javascript
const editor = new HURichTextEditor('#editor', '#preview', {
  size: {
    controlOptions: {
      default: 18,
      min: 8,
      max: 72,
      units: ['px', 'em']
    }
  },
  color: {
    controlOptions: {
      default: '#00FF00'
    }
  }
});
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle bold |
| `Ctrl+I` | Toggle italic |
| `Ctrl+U` | Toggle underline |

---

## Browser Support

- Chrome / Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers (iOS Safari, Chrome Android)

---

## Development

Open `demo/demo.html` in a browser to see the editor in action with a full tag reference and "Try It" buttons for all 35 tags.

```bash
# No build step required — it's a single JS file.
# Just open the demo page:
open demo/demo.html
```

---

# 中文说明

# 轻量级 Unity 富文本编辑器

实现 Unity 标记语法与 HTML 格式无缝转换的富文本编辑工具。支持全部 **35 个 Unity 富文本标签**，提供可视化控件、实时预览和 XSS 防护。

![Demo](demo/demo.gif)
![Demo2](demo/demo2.png)

## 核心特性

- **全部 35 个 Unity 标签** — 完整支持所有 Unity 富文本标签，包括格式化、变换、字体、间距、颜色、链接和特殊标签
- **可视化工具栏** — 分类工具栏，配备颜色选择器、下拉菜单、数字滑块和文本输入控件
- **实时可视化预览** — 输入时同步渲染 HTML 效果，XSS 安全输出（标签处理前先转义 HTML）
- **键盘快捷键** — Ctrl+B（加粗）、Ctrl+I（斜体）、Ctrl+U（下划线）
- **零依赖** — 单文件纯 JavaScript 实现
- **全端适配** — 完美兼容桌面浏览器和移动设备
- **可扩展架构** — 通过 options API 添加自定义标签、控件和验证规则
- **游戏就绪** — 可直接编辑 Unity 游戏中的邮件、公告、UI 文本、对话等富文本内容

## 快速开始

```html
<script src="./html.unity.richtext.js"></script>
<script>
  const editor = new HURichTextEditor('#myTextarea', '#previewContainer');
</script>
```

## 语法速查

### 基础格式（4 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `b` | `<b>文字</b>` | 加粗 |
| `i` | `<i>文字</i>` | 斜体 |
| `u` | `<u>文字</u>` | 下划线 |
| `s` | `<s>文字</s>` | 删除线 |

### 文本变换（6 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `allcaps` | `<allcaps>文字</allcaps>` | 全部大写 |
| `uppercase` | `<uppercase>文字</uppercase>` | 大写变换 |
| `lowercase` | `<lowercase>文字</lowercase>` | 全部小写 |
| `smallcaps` | `<smallcaps>文字</smallcaps>` | 小型大写字母 |
| `sub` | `<sub>文字</sub>` | 下标 |
| `sup` | `<sup>文字</sup>` | 上标 |

### 字体与大小（3 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `font` | `<font="字体名">文字</font>` | 字体族 |
| `font-weight` | `<font-weight="700">文字</font-weight>` | 字重（100–900） |
| `size` | `<size=24>文字</size>` | 字号（支持 px、%、em 单位） |

### 间距与布局（9 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `align` | `<align="center">文字</align>` | 对齐方式 |
| `cspace` | `<cspace=0.1em>文字</cspace>` | 字符间距 |
| `mspace` | `<mspace=2.75em>文字</mspace>` | 等宽字符宽度 |
| `indent` | `<indent=15%>文字</indent>` | 段落缩进 |
| `line-height` | `<line-height=150%>文字</line-height>` | 行高 |
| `line-indent` | `<line-indent=10%>文字</line-indent>` | 首行缩进 |
| `margin` | `<margin=5em>文字</margin>` | 左右边距 |
| `voffset` | `<voffset=0.5em>文字</voffset>` | 垂直偏移 |
| `width` | `<width=60%>文字</width>` | 文本块宽度 |

### 颜色与效果（5 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `color` | `<color=#FF0000>文字</color>` | 文字颜色 |
| `alpha` | `<alpha=#80>文字</alpha>` | 透明度 |
| `mark` | `<mark=#FFFF00AA>文字</mark>` | 高亮/背景色 |
| `gradient` | `<gradient="名称">文字</gradient>` | 渐变预设 |
| `style` | `<style="H1">文字</style>` | 命名样式类 |

### 链接与媒体（3 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `a` | `<a href="网址">文字</a>` | 网页链接 |
| `link` | `<link="id">文字</link>` | 游戏事件链接 |
| `sprite` | `<sprite name="资源名">` | 内联精灵/图片 |

### 特殊标签（5 个标签）

| 标签 | 语法 | 说明 |
|------|------|------|
| `br` | `<br>` | 换行 |
| `space` | `<space=5em>` | 水平空格 |
| `pos` | `<pos=75%>` | 绝对水平位置 |
| `nobr` | `<nobr>文字</nobr>` | 禁止换行 |
| `noparse` | `<noparse>文字</noparse>` | 禁用富文本解析 |

## 可视化控件

工具栏为每种标签类型提供对应的可视化控件：

| 控件类型 | 适用标签 | 说明 |
|----------|----------|------|
| **切换按钮** | `b`、`i`、`u`、`s`、变换类、`nobr`、`noparse` | 点击包裹/取消包裹选中文本 |
| **颜色选择器** | `color` | 原生颜色输入 + 十六进制文本框 + 20 个预设色板 |
| **透明度滑块** | `alpha` | 范围滑块（0–255）+ 棋盘格预览 |
| **高亮选择器** | `mark` | 颜色选择器 + 透明度滑块 + 实时高亮预览 |
| **数字+单位** | `size`、`cspace`、`mspace`、`indent` 等 | 数字输入 + 单位下拉 + 范围滑块 |
| **下拉菜单** | `align`、`font-weight` | 从预定义选项中选择 |
| **文本输入** | `font`、`gradient`、`style`、`a`、`link`、`sprite` | 自由文本输入 + 验证 |

## API 文档

### 构造函数

```javascript
new HURichTextEditor(selector, previewSelector, options?)
```

### 静态工厂

```javascript
HURichTextEditor.create(selector, previewSelector, options?)
```

### 实例方法

- **`editor.applyStyle(tagName, value?)`** — 程序化应用标签
- **`editor.clearAllFormat()`** — 清除所有富文本标签
- **`editor.updateOutput()`** — 手动触发预览重新渲染

### 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+B` | 切换加粗 |
| `Ctrl+I` | 切换斜体 |
| `Ctrl+U` | 切换下划线 |

---

## License

MIT License

Copyright (c) 2024 HTML-Unity-RichText Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
