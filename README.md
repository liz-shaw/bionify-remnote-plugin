# Bionify Reader for RemNote v0.4.6

A sandboxed, read-only Bionic Reading reader for RemNote.

## v0.4.6

- Settings drawer now supports **中文 / English** switching.
- Settings UI is substantially more compact so the rendered document remains visible while tuning.
- Live preview stays near the top of the settings drawer.
- Chinese highlighting now defaults to **highlight first → gap → highlight again**.
- Added a Chinese **Start phase / 起始方式** toggle, so users can choose `Highlight first` or the older `Gap first` behavior.
- Chinese pattern controls are shown in the clearer order `highlight count → gap count`.
- All controls remain in the Reader itself and sync through RemNote storage.

## Development

```bash
npm install
npm run dev
```

Then load `http://localhost:8080` from RemNote's plugin developer settings.
