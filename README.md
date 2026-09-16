# Bionify Reader for RemNote

A sandboxed, read-only Bionify-style reading interface for RemNote, with separate English and Chinese rendering rules.

It reads the currently open RemNote document through the official Plugin SDK and renders a focused reading view without modifying your original notes.

## Features

- English prefix emphasis with configurable rest opacity and emphasis strength.
- Chinese highlight/gap rhythm with configurable highlight count, gap count, opacity, weight, and style.
- Chinese can start with **highlight first** or **gap first**.
- Chinese punctuation and whitespace are preserved but do not count toward the rhythm.
- Built-in settings drawer — no need to edit raw algorithm strings in RemNote plugin settings.
- 中文 / English settings interface.
- Color picker and preset highlight colors.
- Adjustable font size, line height, and reading appearance.
- Expand / collapse document hierarchy.
- Automatically follows the current RemNote document.
- Settings are stored with RemNote synced storage.
- Sandbox mode, read-only permission, and no external network requests.

## How It Works

```text
Current RemNote document
        ↓
RemNote Plugin SDK (read-only)
        ↓
Document tree + text extraction
        ↓
English / Chinese Bionify renderer
        ↓
Bionify Reader
```

The plugin does **not** rewrite the main RemNote editor DOM. It renders a separate reader using data obtained through the official Plugin SDK.

## Install

### RemNote Marketplace

After the plugin is approved, install **Bionify Reader for RemNote** from RemNote's plugin marketplace.

### Local development

Requirements:

- Node.js
- npm
- Git
- RemNote desktop or web app with plugin developer tools enabled

Clone the repository and install dependencies:

```bash
git clone https://github.com/liz-shaw/bionify-remnote-plugin.git
cd bionify-remnote-plugin
npm install
npm run dev
```

Then in RemNote:

```text
Settings → Plugins → Developer / Build → Develop from localhost
```

Load:

```text
http://localhost:8080
```

## Usage

Open a RemNote document, then open **Bionify Reader** from the plugin sidebar.

Use the built-in settings panel to configure rendering. Changes are applied to the Reader and saved through RemNote synced storage.

### English

English words are split into an emphasized prefix and a de-emphasized remainder.

You can configure:

- emphasis strength
- rest opacity
- short-word behavior
- long-word highlight ratio
- per-length highlight counts for short words

### 中文

中文默认采用：

```text
高亮 → 间隔 → 高亮 → 间隔 → …
```

例如设置：

```text
高亮 2 个字
间隔 5 个字
```

会按以下节奏循环：

```text
高亮 2 → 普通 5 → 高亮 2 → 普通 5 → …
```

标点、空格不会计入字符数量。

可调参数包括：

- 高亮字符数
- 间隔字符数
- 起始方式：高亮开始 / 间隔开始
- 非高亮文字透明度
- 高亮粗细
- Soft / Bold / Underline
- 高亮颜色

## Privacy & Permissions

Bionify Reader is designed to use the minimum access needed for its current feature set.

Current manifest settings:

```text
Native mode: disabled
Mobile: disabled
Required scope: All / Read
```

The plugin:

- reads RemNote content required to render the current document;
- does not request write access to your knowledge base;
- does not modify your original Rems;
- does not use Native Mode;
- does not send document content to external services;
- does not make external network requests in the current source code.

## Current Limitations

- Bionify rendering appears inside the plugin Reader, not directly inside RemNote's main editor.
- Mobile support is currently disabled.
- Very large documents may be limited by the Reader's depth / Rem-count safety settings.
- Some rich RemNote content is converted to a simplified reading representation.

## Development

Start the development server:

```bash
npm install
npm run dev
```

Type-check the project:

```bash
npm run check-types
```

Build the marketplace package:

```bash
npm run build
```

The build generates:

```text
PluginZip.zip
```

Upload **PluginZip.zip** to RemNote — do not upload the source ZIP.

## Project Structure

```text
bionify-remnote-plugin/
├── public/
│   ├── manifest.json
│   └── bionify-reader.svg
├── src/
│   ├── lib/
│   │   ├── bionify.ts
│   │   └── remTree.ts
│   └── widgets/
│       ├── index.tsx
│       └── bionify_reader.tsx
├── README.md
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## v0.4.6

- Added 中文 / English settings switching.
- Made the settings drawer substantially more compact so the rendered document stays visible while tuning.
- Added a live preview near the top of the settings drawer.
- Changed Chinese default rhythm to **highlight first → gap → highlight again**.
- Added a Chinese **Start phase / 起始方式** toggle.
- Reordered Chinese controls to `highlight count → gap count` for clearer configuration.
- Kept all normal user controls inside the Reader instead of RemNote's plugin settings page.

## Credits

This project adapts the Bionify reading concept for RemNote.

The browser-extension lineage is based on the original **Bionify** project by Vincent Wu and its contributors:

- Original project: https://github.com/cveinnt/bionify
- Original author: Vincent Wu

## License

GPL-3.0-or-later.
