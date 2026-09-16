import React from 'react';
import {
  AppEvents,
  renderWidget,
  usePlugin,
} from '@remnote/plugin-sdk';
import {
  BionifyConfig,
  clamp,
  getWordHighlightLength,
  isCjkCharacter,
  parseChineseSettings,
  parseEnglishAlgorithm,
  safeColor,
} from '../lib/bionify';
import {
  collectTreeIds,
  readRemTree,
  type ReadTreeResult,
  type RemTreeNode,
} from '../lib/remTree';

const SETTINGS_STORAGE_KEY = 'bionify-reader-settings-v3';
const LEGACY_APPEARANCE_STORAGE_KEY = 'bionify-reader-appearance-v2';

const shellStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  boxSizing: 'border-box',
  background: 'var(--rn-clr-background-primary)',
  color: 'var(--rn-clr-content-primary)',
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.25))',
  borderRadius: 8,
  background: 'var(--rn-clr-background-secondary, transparent)',
  color: 'var(--rn-clr-content-primary)',
  cursor: 'pointer',
  padding: '6px 9px',
  fontSize: 12,
  lineHeight: 1.2,
};

const DEFAULT_UI_LANGUAGE: 'zh' | 'en' =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en';

const DEFAULT_UI_SETTINGS: ReaderUiSettings = {
  uiLanguage: DEFAULT_UI_LANGUAGE,
  enabled: true,
  colorEnabled: false,
  color: '#11b500',
  englishRestOpacity: 0.55,
  englishBoldWeight: 0.9,
  englishExcludeCommonShortWords: true,
  englishSizes: [0, 1, 1, 2],
  englishRestRatio: 0.4,
  chineseGap: 5,
  chineseHighlight: 2,
  chineseStartHighlighted: true,
  chineseGapOpacity: 0.5,
  chineseBoldWeight: 0.9,
  chineseIntensity: 2,
  fontSize: 16,
  lineHeight: 1.7,
  showBackText: true,
  maxDepth: 12,
  maxNodes: 900,
};

const COLOR_PRESETS = [
  '#11b500',
  '#ff4fa3',
  '#8b5cf6',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
];

type ReaderUiSettings = {
  uiLanguage: 'zh' | 'en';
  enabled: boolean;
  colorEnabled: boolean;
  color: string;
  englishRestOpacity: number;
  englishBoldWeight: number;
  englishExcludeCommonShortWords: boolean;
  englishSizes: [number, number, number, number];
  englishRestRatio: number;
  chineseGap: number;
  chineseHighlight: number;
  chineseStartHighlighted: boolean;
  chineseGapOpacity: number;
  chineseBoldWeight: number;
  chineseIntensity: 1 | 2 | 3;
  fontSize: number;
  lineHeight: number;
  showBackText: boolean;
  maxDepth: number;
  maxNodes: number;
};

type ReaderSettings = {
  ui: ReaderUiSettings;
  enabled: boolean;
  config: BionifyConfig;
  showBackText: boolean;
  fontSize: number;
  lineHeight: number;
  maxDepth: number;
  maxNodes: number;
};

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(clamp(n, min, max)) : fallback;
}

function normalizeEnglishSizes(value: unknown): [number, number, number, number] {
  const raw = Array.isArray(value) ? value : DEFAULT_UI_SETTINGS.englishSizes;
  return [
    integer(raw[0], 0, 0, 1),
    integer(raw[1], 1, 0, 2),
    integer(raw[2], 1, 0, 3),
    integer(raw[3], 2, 0, 4),
  ];
}

function normalizeUiSettings(value: unknown): ReaderUiSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<ReaderUiSettings>;
  const intensity = Number(raw.chineseIntensity ?? DEFAULT_UI_SETTINGS.chineseIntensity);

  return {
    uiLanguage: raw.uiLanguage === 'zh' || raw.uiLanguage === 'en' ? raw.uiLanguage : DEFAULT_UI_LANGUAGE,
    enabled: raw.enabled !== false,
    colorEnabled: Boolean(raw.colorEnabled),
    color: safeColor(raw.color ?? DEFAULT_UI_SETTINGS.color),
    englishRestOpacity: clamp(
      Number(raw.englishRestOpacity ?? DEFAULT_UI_SETTINGS.englishRestOpacity),
      0.2,
      1
    ),
    englishBoldWeight: clamp(
      Number(raw.englishBoldWeight ?? DEFAULT_UI_SETTINGS.englishBoldWeight),
      0,
      1
    ),
    englishExcludeCommonShortWords:
      raw.englishExcludeCommonShortWords !== false,
    englishSizes: normalizeEnglishSizes(raw.englishSizes),
    englishRestRatio: clamp(
      Number(raw.englishRestRatio ?? DEFAULT_UI_SETTINGS.englishRestRatio),
      0,
      1
    ),
    chineseGap: integer(raw.chineseGap, DEFAULT_UI_SETTINGS.chineseGap, 0, 30),
    chineseHighlight: integer(
      raw.chineseHighlight,
      DEFAULT_UI_SETTINGS.chineseHighlight,
      1,
      30
    ),
    chineseStartHighlighted: raw.chineseStartHighlighted !== false,
    chineseGapOpacity: clamp(
      Number(raw.chineseGapOpacity ?? DEFAULT_UI_SETTINGS.chineseGapOpacity),
      0.15,
      1
    ),
    chineseBoldWeight: clamp(
      Number(raw.chineseBoldWeight ?? DEFAULT_UI_SETTINGS.chineseBoldWeight),
      0,
      1
    ),
    chineseIntensity: (intensity === 1 || intensity === 3 ? intensity : 2) as 1 | 2 | 3,
    fontSize: clamp(Number(raw.fontSize ?? DEFAULT_UI_SETTINGS.fontSize), 12, 30),
    lineHeight: clamp(Number(raw.lineHeight ?? DEFAULT_UI_SETTINGS.lineHeight), 1.2, 2.4),
    showBackText: raw.showBackText !== false,
    maxDepth: integer(raw.maxDepth, DEFAULT_UI_SETTINGS.maxDepth, 1, 30),
    maxNodes: integer(raw.maxNodes, DEFAULT_UI_SETTINGS.maxNodes, 50, 5000),
  };
}

function settingsFromUi(uiInput: ReaderUiSettings): ReaderSettings {
  const ui = normalizeUiSettings(uiInput);
  return {
    ui,
    enabled: ui.enabled,
    config: {
      english: {
        excludeCommonShortWords: ui.englishExcludeCommonShortWords,
        sizes: [...ui.englishSizes],
        restRatio: ui.englishRestRatio,
      },
      chinese: {
        gap: ui.chineseGap,
        highlight: ui.chineseHighlight,
        gapOpacity: ui.chineseGapOpacity,
        boldWeight: ui.chineseBoldWeight,
        intensity: ui.chineseIntensity,
        startHighlighted: ui.chineseStartHighlighted,
      },
      englishRestOpacity: ui.englishRestOpacity,
      englishBoldWeight: ui.englishBoldWeight,
      colorEnabled: ui.colorEnabled,
      color: ui.color,
    },
    showBackText: ui.showBackText,
    fontSize: ui.fontSize,
    lineHeight: ui.lineHeight,
    maxDepth: ui.maxDepth,
    maxNodes: ui.maxNodes,
  };
}

async function loadReaderSettings(plugin: ReturnType<typeof usePlugin>): Promise<ReaderSettings> {
  const stored = await plugin.storage.getSynced(SETTINGS_STORAGE_KEY);
  if (stored) return settingsFromUi(normalizeUiSettings(stored));

  // One-time migration from v0.4.4 and earlier. Old plugin-page values are
  // read opportunistically, but all future edits live in this Reader drawer.
  const legacyAppearance = (await plugin.storage.getSynced(LEGACY_APPEARANCE_STORAGE_KEY)) as
    | Record<string, unknown>
    | undefined;
  let migrated: Record<string, unknown> = {
    ...DEFAULT_UI_SETTINGS,
    ...(legacyAppearance || {}),
  };

  try {
    const [englishRaw, chineseRaw, showBackText, maxDepth, maxNodes] = await Promise.all([
      plugin.settings.getSetting<string>('english-algorithm'),
      plugin.settings.getSetting<string>('chinese-settings'),
      plugin.settings.getSetting<boolean>('show-back-text'),
      plugin.settings.getSetting<number>('reader-max-depth'),
      plugin.settings.getSetting<number>('reader-max-nodes'),
    ]);

    if (englishRaw) {
      const english = parseEnglishAlgorithm(englishRaw);
      migrated = {
        ...migrated,
        englishExcludeCommonShortWords: english.excludeCommonShortWords,
        englishSizes: [
          english.sizes[0] ?? 0,
          english.sizes[1] ?? 1,
          english.sizes[2] ?? 1,
          english.sizes[3] ?? 2,
        ],
        englishRestRatio: english.restRatio,
      };
    }

    if (chineseRaw) {
      const chinese = parseChineseSettings(chineseRaw);
      migrated = {
        ...migrated,
        chineseGap: chinese.gap,
        chineseHighlight: chinese.highlight,
        // Keep the stronger v0.4.4 appearance values if they already exist.
        chineseGapOpacity:
          legacyAppearance?.chineseGapOpacity ?? chinese.gapOpacity,
        chineseBoldWeight:
          legacyAppearance?.chineseBoldWeight ?? chinese.boldWeight,
        chineseIntensity:
          legacyAppearance?.chineseIntensity ?? chinese.intensity,
      };
    }

    if (typeof showBackText === 'boolean') migrated.showBackText = showBackText;
    if (typeof maxDepth === 'number') migrated.maxDepth = maxDepth;
    if (typeof maxNodes === 'number') migrated.maxNodes = maxNodes;
  } catch (e) {
    console.debug('[Bionify Reader] Legacy plugin settings not available; using defaults.', e);
  }

  const ui = normalizeUiSettings(migrated);
  await plugin.storage.setSynced(SETTINGS_STORAGE_KEY, ui);
  return settingsFromUi(ui);
}

function BionifyReader() {
  const plugin = usePlugin();
  const [settings, setSettings] = React.useState<ReaderSettings | null>(null);
  const [currentRemId, setCurrentRemId] = React.useState<string | null>(null);
  const [treeResult, setTreeResult] = React.useState<ReadTreeResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const treeIdsRef = React.useRef<Set<string>>(new Set());
  const remIdRef = React.useRef<string | null>(null);
  const refreshTimerRef = React.useRef<number | null>(null);
  const settingsSaveTimerRef = React.useRef<number | null>(null);

  const resolveCurrentDocument = React.useCallback(async () => {
    try {
      const paneId = await plugin.window.getFocusedPaneId();
      if (!paneId) return;
      const remId = await plugin.window.getOpenPaneRemId(paneId);
      const nextId = remId || null;
      if (nextId !== remIdRef.current) {
        remIdRef.current = nextId;
        setCurrentRemId(nextId);
        setCollapsed(new Set());
      }
    } catch (e) {
      console.error('[Bionify Reader] Could not resolve current document:', e);
    }
  }, [plugin]);

  const reloadSettings = React.useCallback(async () => {
    try {
      const next = await loadReaderSettings(plugin);
      setSettings(next);
      return next;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Could not read Bionify settings: ${message}`);
      console.error('[Bionify Reader] settings error:', e);
      return null;
    }
  }, [plugin]);

  const scheduleTreeRefresh = React.useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      setRefreshNonce((n) => n + 1);
      refreshTimerRef.current = null;
    }, 180);
  }, []);

  const persistUiSettings = React.useCallback(
    (ui: ReaderUiSettings) => {
      if (settingsSaveTimerRef.current !== null) {
        window.clearTimeout(settingsSaveTimerRef.current);
      }
      settingsSaveTimerRef.current = window.setTimeout(() => {
        void plugin.storage
          .setSynced(SETTINGS_STORAGE_KEY, ui)
          .catch((e: unknown) => console.error('[Bionify Reader] settings save error:', e));
        settingsSaveTimerRef.current = null;
      }, 120);
    },
    [plugin]
  );

  const updateUiSettings = React.useCallback(
    (patch: Partial<ReaderUiSettings>) => {
      setSettings((current) => {
        if (!current) return current;
        const nextUi = normalizeUiSettings({ ...current.ui, ...patch });
        persistUiSettings(nextUi);
        return settingsFromUi(nextUi);
      });
    },
    [persistUiSettings]
  );

  const updateEnglishSize = React.useCallback(
    (index: number, value: number) => {
      setSettings((current) => {
        if (!current) return current;
        const sizes = [...current.ui.englishSizes] as [number, number, number, number];
        sizes[index] = value;
        const nextUi = normalizeUiSettings({ ...current.ui, englishSizes: sizes });
        persistUiSettings(nextUi);
        return settingsFromUi(nextUi);
      });
    },
    [persistUiSettings]
  );

  const resetUiSettings = React.useCallback(() => {
    const next = normalizeUiSettings(DEFAULT_UI_SETTINGS);
    setSettings(settingsFromUi(next));
    persistUiSettings(next);
  }, [persistUiSettings]);

  React.useEffect(() => {
    let mounted = true;

    const init = async () => {
      await reloadSettings();
      if (mounted) await resolveCurrentDocument();
    };
    void init();

    const pollId = window.setInterval(() => {
      void resolveCurrentDocument();
    }, 1000);

    const onOpenRem = () => {
      void resolveCurrentDocument();
    };

    const onRemChanged = (event: { remId: string }) => {
      const ids = treeIdsRef.current;
      if (ids.size === 0 || ids.has(event.remId)) {
        scheduleTreeRefresh();
      }
    };

    plugin.event.addListener(AppEvents.GlobalOpenRem, undefined, onOpenRem);
    plugin.event.addListener(AppEvents.GlobalRemChanged, undefined, onRemChanged);

    return () => {
      mounted = false;
      window.clearInterval(pollId);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      if (settingsSaveTimerRef.current !== null) {
        window.clearTimeout(settingsSaveTimerRef.current);
      }
      plugin.event.removeListener(AppEvents.GlobalOpenRem, undefined, onOpenRem);
      plugin.event.removeListener(AppEvents.GlobalRemChanged, undefined, onRemChanged);
    };
  }, [plugin, reloadSettings, resolveCurrentDocument, scheduleTreeRefresh]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!settings) return;
      if (!currentRemId) {
        setTreeResult(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const rem = await plugin.rem.findOne(currentRemId);
        if (!rem) {
          if (!cancelled) {
            setTreeResult(null);
            setLoading(false);
          }
          return;
        }

        const result = await readRemTree(plugin, rem, {
          includeBackText: settings.showBackText,
          maxDepth: settings.maxDepth,
          maxNodes: settings.maxNodes,
        });

        if (!cancelled) {
          treeIdsRef.current = collectTreeIds(result.root);
          setTreeResult(result);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(`Could not read this document: ${message}`);
          setLoading(false);
          console.error('[Bionify Reader] document read error:', e);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [plugin, currentRemId, settings?.showBackText, settings?.maxDepth, settings?.maxNodes, refreshNonce]);

  const refreshEverything = async () => {
    await reloadSettings();
    await resolveCurrentDocument();
    setRefreshNonce((n) => n + 1);
  };

  if (error) {
    return (
      <ReaderMessage
        title="Bionify Reader"
        body={error}
        actionLabel="Retry"
        onAction={() => void refreshEverything()}
      />
    );
  }

  if (!settings) {
    return <ReaderMessage title="Bionify Reader" body="Loading settings…" />;
  }

  if (!currentRemId) {
    return (
      <ReaderMessage
        title="Bionify Reader"
        body="Open a RemNote document. The reader will follow the document in the focused pane."
        actionLabel="Refresh"
        onAction={() => void refreshEverything()}
      />
    );
  }

  if (loading || !treeResult) {
    return <ReaderMessage title="Bionify Reader" body="Reading this document…" />;
  }

  const collapseAll = () => {
    const ids = new Set<string>();
    const stack = [...treeResult.root.children];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      if (node.children.length > 0) ids.add(node.id);
      stack.push(...node.children);
    }
    setCollapsed(ids);
  };

  const expandAll = () => setCollapsed(new Set());

  return (
    <div style={shellStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '12px 12px 10px',
          background: 'var(--rn-clr-background-primary)',
          borderBottom: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.18))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 750 }}>Bionify Reader</div>
            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                opacity: 0.72,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {settings.enabled ? 'Bionify ON' : 'Bionify OFF'} · sandbox · read-only
            </div>
          </div>
          <button
            style={{
              ...buttonStyle,
              borderColor: settingsOpen
                ? 'var(--rn-clr-accent, rgba(99,102,241,0.7))'
                : buttonStyle.border as string,
            }}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {settings.ui.uiLanguage === 'zh' ? '⚙ 设置' : '⚙ Settings'}
          </button>
          <button style={buttonStyle} onClick={() => void refreshEverything()}>
            {settings.ui.uiLanguage === 'zh' ? '刷新' : 'Refresh'}
          </button>
        </div>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            updateUiSettings={updateUiSettings}
            updateEnglishSize={updateEnglishSize}
            resetUiSettings={resetUiSettings}
          />
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          <button style={buttonStyle} onClick={expandAll}>
            {settings.ui.uiLanguage === 'zh' ? '全部展开' : 'Expand all'}
          </button>
          <button style={buttonStyle} onClick={collapseAll}>
            {settings.ui.uiLanguage === 'zh' ? '全部折叠' : 'Collapse all'}
          </button>
          <span
            style={{
              alignSelf: 'center',
              fontSize: 10,
              opacity: 0.58,
              marginLeft: 2,
            }}
          >
            {treeResult.nodeCount} Rem{treeResult.nodeCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '16px 14px 48px',
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
        }}
      >
        <div
          style={{
            fontSize: Math.max(settings.fontSize + 5, 20),
            lineHeight: 1.35,
            fontWeight: 760,
            marginBottom: 16,
            letterSpacing: '-0.015em',
          }}
        >
          <BionicText
            text={treeResult.root.text || 'Untitled'}
            enabled={settings.enabled}
            config={settings.config}
          />
        </div>

        {treeResult.root.backText && (
          <BackTextBlock
            text={treeResult.root.backText}
            enabled={settings.enabled}
            config={settings.config}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {treeResult.root.children.map((node) => (
            <RemNodeView
              key={node.id}
              node={node}
              depth={0}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              enabled={settings.enabled}
              config={settings.config}
              fontSize={settings.fontSize}
              lineHeight={settings.lineHeight}
              openRem={async (id) => {
                const rem = await plugin.rem.findOne(id);
                if (rem) await plugin.window.openRem(rem);
              }}
            />
          ))}
        </div>

        {treeResult.truncated && (
          <div
            style={{
              marginTop: 18,
              padding: 10,
              borderRadius: 9,
              fontSize: 12,
              lineHeight: 1.5,
              background: 'var(--rn-clr-background-secondary, rgba(127,127,127,0.08))',
              opacity: 0.78,
            }}
          >
            This document hit the safety limit. Open ⚙ Settings → Content & safety
            and increase the Rem count or depth limit if you need more content.
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  updateUiSettings,
  updateEnglishSize,
  resetUiSettings,
}: {
  settings: ReaderSettings;
  updateUiSettings: (patch: Partial<ReaderUiSettings>) => void;
  updateEnglishSize: (index: number, value: number) => void;
  resetUiSettings: () => void;
}) {
  const ui = settings.ui;
  const zh = ui.uiLanguage === 'zh';
  const tr = (zhText: string, enText: string) => (zh ? zhText : enText);

  return (
    <div
      style={{
        marginTop: 7,
        padding: 8,
        borderRadius: 10,
        border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.22))',
        background: 'var(--rn-clr-background-secondary, rgba(127,127,127,0.06))',
        boxShadow: '0 5px 18px rgba(0,0,0,0.10)',
        maxHeight: 'min(45vh, 480px)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: -8,
          zIndex: 2,
          margin: '-8px -8px 0',
          padding: '7px 8px 6px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          background: 'var(--rn-clr-background-secondary, rgba(127,127,127,0.06))',
          borderBottom: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.12))',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 780, fontSize: 12.5 }}>
            {tr('Bionify 设置', 'Bionify Settings')}
          </div>
          <div style={{ marginTop: 1, fontSize: 9.5, opacity: 0.56 }}>
            {tr('自动保存并同步', 'Auto-saved and synced')}
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.22))',
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          {(['zh', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => updateUiSettings({ uiLanguage: lang })}
              style={{
                border: 0,
                padding: '3px 6px',
                cursor: 'pointer',
                color: 'inherit',
                fontSize: 10,
                fontWeight: ui.uiLanguage === lang ? 760 : 500,
                background:
                  ui.uiLanguage === lang
                    ? 'var(--rn-clr-background-accent, rgba(99,102,241,0.18))'
                    : 'transparent',
              }}
            >
              {lang === 'zh' ? '中文' : 'EN'}
            </button>
          ))}
        </div>

        <button
          style={{ ...buttonStyle, padding: '3px 6px', fontSize: 10.5, opacity: 0.82 }}
          onClick={resetUiSettings}
        >
          {tr('重置', 'Reset')}
        </button>
      </div>

      <div
        style={{
          marginTop: 6,
          padding: '5px 7px',
          borderRadius: 7,
          background: 'var(--rn-clr-background-primary)',
          border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.14))',
          fontSize: 11.5,
          lineHeight: 1.35,
        }}
      >
        <BionicText
          text={
            zh
              ? '实时预览：缓存能提高处理器性能。中文从高亮开始，间隔后再次高亮。'
              : 'Live preview: Cache memory improves processor performance. 中文从高亮开始，间隔后再次高亮。'
          }
          enabled={settings.enabled}
          config={settings.config}
        />
      </div>

      <div style={{ marginTop: 5 }}>
        <SettingsSection title={tr('常规', 'General')}>
          <SettingRow label={tr('Bionify 强调', 'Bionify emphasis')}>
            <PillToggle
              on={ui.enabled}
              onLabel={tr('开启', 'ON')}
              offLabel={tr('关闭', 'OFF')}
              onChange={(value) => updateUiSettings({ enabled: value })}
            />
          </SettingRow>
          <SettingRow label={tr('显示答案 / 背面', 'Show answers / back text')}>
            <PillToggle
              on={ui.showBackText}
              onLabel={tr('显示', 'Show')}
              offLabel={tr('隐藏', 'Hide')}
              onChange={(value) => updateUiSettings({ showBackText: value })}
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={tr('高亮', 'Highlight')}>
          <SettingRow label={tr('高亮颜色', 'Highlight color')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <PillToggle
                on={ui.colorEnabled}
                onLabel={tr('颜色', 'Color')}
                offLabel={tr('仅粗细', 'Weight only')}
                onChange={(value) => updateUiSettings({ colorEnabled: value })}
              />
              <label
                title={tr('选择高亮颜色', 'Choose highlight color')}
                style={{
                  width: 29,
                  height: 25,
                  borderRadius: 7,
                  border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.3))',
                  background: ui.color,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: ui.colorEnabled ? `0 0 0 2px ${ui.color}44` : undefined,
                }}
              >
                <input
                  type="color"
                  value={ui.color}
                  onChange={(e) =>
                    updateUiSettings({ color: safeColor(e.target.value), colorEnabled: true })
                  }
                  style={{
                    position: 'absolute',
                    inset: -8,
                    width: 48,
                    height: 44,
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </label>
            </div>
          </SettingRow>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '2px 0 6px' }}>
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                title={color}
                aria-label={color}
                onClick={() => updateUiSettings({ color, colorEnabled: true })}
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 999,
                  border:
                    ui.colorEnabled && ui.color.toLowerCase() === color.toLowerCase()
                      ? '2px solid var(--rn-clr-content-primary)'
                      : '1px solid rgba(127,127,127,0.35)',
                  outline:
                    ui.colorEnabled && ui.color.toLowerCase() === color.toLowerCase()
                      ? `1px solid ${color}66`
                      : 'none',
                  outlineOffset: 1,
                  background: color,
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={tr('英文', 'English')}>
          <SettingRow
            label={tr('常见短词', 'Common short words')}
            hint={tr('如 the、of、and、to。', 'Such as the, of, and, to.')}
          >
            <PillToggle
              on={ui.englishExcludeCommonShortWords}
              onLabel={tr('跳过', 'Skip')}
              offLabel={tr('强调', 'Emphasize')}
              onChange={(value) => updateUiSettings({ englishExcludeCommonShortWords: value })}
            />
          </SettingRow>
          <RangeControl
            label={tr('非强调部分透明度', 'Rest opacity')}
            value={ui.englishRestOpacity}
            min={0.2}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(value) => updateUiSettings({ englishRestOpacity: value })}
          />
          <RangeControl
            label={tr('强调强度', 'Emphasis strength')}
            value={ui.englishBoldWeight}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(value) => updateUiSettings({ englishBoldWeight: value })}
          />
          <RangeControl
            label={tr('长词高亮比例', 'Long-word highlighted ratio')}
            value={ui.englishRestRatio}
            min={0.1}
            max={0.9}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(value) => updateUiSettings({ englishRestRatio: value })}
          />

          <div style={{ marginTop: 1, marginBottom: 4, fontSize: 10.5, fontWeight: 680 }}>
            {tr('短词高亮字符数', 'Short-word highlighted characters')}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 5,
              marginBottom: 2,
            }}
          >
            {ui.englishSizes.map((value, index) => (
              <CompactNumberControl
                key={index}
                label={tr(`${index + 1} 字母单词`, `${index + 1}-letter word`)}
                value={value}
                min={0}
                max={index + 1}
                step={1}
                onChange={(next) => updateEnglishSize(index, next)}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={tr('中文', 'Chinese')}>
          <SettingRow
            label={tr('起始方式', 'Start phase')}
            hint={tr('推荐从高亮开始，再间隔，再高亮。', 'Recommended: highlight first, then gap, then highlight again.')}
          >
            <PillToggle
              on={ui.chineseStartHighlighted}
              onLabel={tr('高亮开始', 'Highlight')}
              offLabel={tr('间隔开始', 'Gap')}
              onChange={(value) => updateUiSettings({ chineseStartHighlighted: value })}
            />
          </SettingRow>

          <SettingRow
            label={tr('循环模式', 'Pattern')}
            hint={tr('标点和空格不计数。', 'Punctuation and spaces do not count.')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CompactStepper
                value={ui.chineseHighlight}
                min={1}
                max={30}
                step={1}
                onChange={(value) => updateUiSettings({ chineseHighlight: value })}
              />
              <span style={{ fontSize: 9.5, opacity: 0.58 }}>{tr('高亮', 'strong')}</span>
              <CompactStepper
                value={ui.chineseGap}
                min={0}
                max={30}
                step={1}
                onChange={(value) => updateUiSettings({ chineseGap: value })}
              />
              <span style={{ fontSize: 9.5, opacity: 0.58 }}>{tr('间隔', 'gap')}</span>
            </div>
          </SettingRow>

          <RangeControl
            label={tr('间隔透明度', 'Gap opacity')}
            value={ui.chineseGapOpacity}
            min={0.15}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(value) => updateUiSettings({ chineseGapOpacity: value })}
          />
          <RangeControl
            label={tr('高亮强度', 'Emphasis strength')}
            value={ui.chineseBoldWeight}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(value) => updateUiSettings({ chineseBoldWeight: value })}
          />

          <SettingRow label={tr('高亮样式', 'Emphasis style')}>
            <div style={{ display: 'flex', gap: 4 }}>
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => updateUiSettings({ chineseIntensity: level })}
                  style={{
                    ...buttonStyle,
                    padding: '4px 6px',
                    fontSize: 10.5,
                    background:
                      ui.chineseIntensity === level
                        ? 'var(--rn-clr-background-accent, rgba(99,102,241,0.18))'
                        : buttonStyle.background,
                    fontWeight: ui.chineseIntensity === level ? 750 : 500,
                  }}
                >
                  {level === 1
                    ? tr('柔和', 'Soft')
                    : level === 2
                      ? tr('粗体', 'Bold')
                      : tr('下划线', 'Underline')}
                </button>
              ))}
            </div>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={tr('阅读', 'Reading')}>
          <RangeControl
            label={tr('字号', 'Font size')}
            value={ui.fontSize}
            min={12}
            max={30}
            step={1}
            format={(v) => `${Math.round(v)} px`}
            onChange={(value) => updateUiSettings({ fontSize: value })}
          />
          <RangeControl
            label={tr('行距', 'Line height')}
            value={ui.lineHeight}
            min={1.2}
            max={2.4}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={(value) => updateUiSettings({ lineHeight: value })}
          />
        </SettingsSection>

        <SettingsSection title={tr('内容与安全', 'Content & safety')} subtle>
          <SettingRow label={tr('最大 Rem 深度', 'Maximum Rem depth')}>
            <CompactStepper
              value={ui.maxDepth}
              min={1}
              max={30}
              step={1}
              onChange={(value) => updateUiSettings({ maxDepth: value })}
            />
          </SettingRow>
          <SettingRow label={tr('最大 Rem 数量', 'Maximum Rem count')}>
            <CompactStepper
              value={ui.maxNodes}
              min={50}
              max={5000}
              step={50}
              onChange={(value) => updateUiSettings({ maxNodes: value })}
            />
          </SettingRow>
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
  subtle = false,
}: {
  title: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <section
      style={{
        paddingTop: 6,
        marginTop: 4,
        borderTop: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.13))',
        opacity: subtle ? 0.88 : 1,
      }}
    >
      <div
        style={{
          marginBottom: 5,
          fontSize: 9.5,
          fontWeight: 780,
          letterSpacing: '0.055em',
          textTransform: 'uppercase',
          opacity: 0.58,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function CompactStepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const nextValue = (delta: number) => {
    const next = Math.round((value + delta) / step) * step;
    onChange(clamp(next, min, max));
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.25))',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--rn-clr-background-primary)',
      }}
    >
      <button
        aria-label="Decrease"
        onClick={() => nextValue(-step)}
        disabled={value <= min}
        style={{
          width: 24,
          height: 24,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          cursor: value <= min ? 'default' : 'pointer',
          opacity: value <= min ? 0.28 : 0.8,
        }}
      >
        −
      </button>
      <span
        style={{
          minWidth: value >= 100 ? 42 : 27,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 720,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <button
        aria-label="Increase"
        onClick={() => nextValue(step)}
        disabled={value >= max}
        style={{
          width: 24,
          height: 24,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          cursor: value >= max ? 'default' : 'pointer',
          opacity: value >= max ? 0.28 : 0.8,
        }}
      >
        +
      </button>
    </div>
  );
}

function CompactNumberControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      style={{
        padding: '5px 6px',
        borderRadius: 7,
        border: '1px solid var(--rn-clr-border-primary, rgba(127,127,127,0.15))',
        background: 'var(--rn-clr-background-primary)',
      }}
    >
      <div style={{ marginBottom: 4, fontSize: 9.5, opacity: 0.62 }}>{label}</div>
      <CompactStepper value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(110px,1fr) auto',
        gap: 7,
        alignItems: 'center',
        marginBottom: 6,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 650 }}>{label}</div>
        {hint && (
          <div style={{ marginTop: 1, fontSize: 9.5, opacity: 0.58, lineHeight: 1.25 }}>
            {hint}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function PillToggle({
  on,
  onLabel,
  offLabel,
  onChange,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        ...buttonStyle,
        minWidth: 62,
        background: on
          ? 'var(--rn-clr-background-accent, rgba(99,102,241,0.2))'
          : buttonStyle.background,
        fontWeight: on ? 700 : 500,
      }}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 650, flex: 1 }}>{label}</div>
        <div
          style={{
            minWidth: 52,
            textAlign: 'right',
            fontSize: 10,
            opacity: 0.68,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format(value)}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', marginTop: 2, cursor: 'pointer' }}
      />
    </div>
  );
}

function ReaderMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div style={{ ...shellStyle, padding: 16 }}>
      <div style={{ fontWeight: 750, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.68, fontSize: 13, lineHeight: 1.55 }}>
        {body}
      </div>
      {actionLabel && onAction && (
        <button style={{ ...buttonStyle, marginTop: 12 }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function RemNodeView({
  node,
  depth,
  collapsed,
  setCollapsed,
  enabled,
  config,
  fontSize,
  lineHeight,
  openRem,
}: {
  node: RemTreeNode;
  depth: number;
  collapsed: Set<string>;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>;
  enabled: boolean;
  config: BionifyConfig;
  fontSize: number;
  lineHeight: number;
  openRem: (id: string) => Promise<void>;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const indent = Math.min(depth, 7) * 11;

  const toggle = () => {
    if (!hasChildren) return;
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  return (
    <div style={{ marginLeft: indent }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '18px minmax(0,1fr)',
          gap: 4,
          alignItems: 'start',
          borderRadius: 8,
          padding: '4px 4px 5px 2px',
        }}
      >
        <button
          onClick={toggle}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          style={{
            width: 18,
            height: 22,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            opacity: hasChildren ? 0.55 : 0.22,
            cursor: hasChildren ? 'pointer' : 'default',
            fontSize: 12,
          }}
        >
          {hasChildren ? (isCollapsed ? '▸' : '▾') : '•'}
        </button>

        <div style={{ minWidth: 0 }}>
          {node.text && (
            <div
              onDoubleClick={() => void openRem(node.id)}
              title="Double-click to open this Rem"
              style={{
                fontSize,
                lineHeight,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              <BionicText text={node.text} enabled={enabled} config={config} />
            </div>
          )}

          {node.backText && (
            <BackTextBlock text={node.backText} enabled={enabled} config={config} />
          )}
        </div>
      </div>

      {!isCollapsed &&
        node.children.map((child) => (
          <RemNodeView
            key={child.id}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            enabled={enabled}
            config={config}
            fontSize={fontSize}
            lineHeight={lineHeight}
            openRem={openRem}
          />
        ))}
    </div>
  );
}

function BackTextBlock({
  text,
  enabled,
  config,
}: {
  text: string;
  enabled: boolean;
  config: BionifyConfig;
}) {
  return (
    <div
      style={{
        marginTop: 5,
        padding: '6px 9px',
        borderLeft: '2px solid var(--rn-clr-accent, rgba(127,127,127,0.35))',
        borderRadius: '0 7px 7px 0',
        background: 'var(--rn-clr-background-secondary, rgba(127,127,127,0.06))',
        opacity: 0.88,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}
    >
      <BionicText text={text} enabled={enabled} config={config} />
    </div>
  );
}

function BionicText({
  text,
  enabled,
  config,
}: {
  text: string;
  enabled: boolean;
  config: BionifyConfig;
}) {
  if (!enabled || !text) return <>{text}</>;

  const result: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let cjkCount = 0;
  const cycleLength = config.chinese.gap + config.chinese.highlight;

  while (i < text.length) {
    const char = text[i];

    if (/[A-Za-z0-9]/.test(char)) {
      let end = i + 1;
      while (end < text.length && /[A-Za-z0-9]/.test(text[end])) end += 1;
      const word = text.slice(i, end);
      const highlightLength = getWordHighlightLength(word, config.english);
      const strong = word.slice(0, highlightLength);
      const rest = word.slice(highlightLength);

      if (strong) {
        result.push(
          <span
            key={`e-${key++}`}
            style={{
              fontWeight: Math.round(500 + config.englishBoldWeight * 400),
              textShadow:
                config.englishBoldWeight >= 0.75
                  ? '0.018em 0 currentColor, -0.018em 0 currentColor'
                  : undefined,
              color: config.colorEnabled ? config.color : undefined,
            }}
          >
            {strong}
          </span>
        );
      }

      if (rest) {
        result.push(
          <span key={`r-${key++}`} style={{ opacity: config.englishRestOpacity }}>
            {rest}
          </span>
        );
      }

      i = end;
      continue;
    }

    if (isCjkCharacter(char) && cycleLength > 0) {
      const isHighlightAt = (count: number) => {
        const phase = count % cycleLength;
        return config.chinese.startHighlighted
          ? phase < config.chinese.highlight
          : phase >= config.chinese.gap;
      };
      const isHighlight = isHighlightAt(cjkCount);
      const start = i;
      let end = i;

      while (end < text.length) {
        const current = text[end];
        if (!isCjkCharacter(current)) break;
        const currentHighlight = isHighlightAt(cjkCount);
        if (currentHighlight !== isHighlight) break;
        cjkCount += 1;
        end += current.length;
      }

      const segment = text.slice(start, end);
      if (isHighlight) {
        const shadowWidth = Math.max(0.022, config.chinese.boldWeight * 0.05).toFixed(3);
        result.push(
          <span
            key={`c-${key++}`}
            style={{
              fontWeight:
                config.chinese.intensity === 1
                  ? 500
                  : Math.round(500 + config.chinese.boldWeight * 400),
              textShadow:
                config.chinese.intensity >= 2
                  ? `${shadowWidth}em 0 currentColor, -${shadowWidth}em 0 currentColor`
                  : undefined,
              color: config.colorEnabled ? config.color : undefined,
              textDecoration:
                config.chinese.intensity === 3 ? 'underline' : undefined,
              textUnderlineOffset:
                config.chinese.intensity === 3 ? '0.12em' : undefined,
            }}
          >
            {segment}
          </span>
        );
      } else {
        result.push(
          <span key={`cr-${key++}`} style={{ opacity: config.chinese.gapOpacity }}>
            {segment}
          </span>
        );
      }

      i = end;
      continue;
    }

    result.push(<React.Fragment key={`p-${key++}`}>{char}</React.Fragment>);
    i += char.length;
  }

  return <>{result}</>;
}

renderWidget(BionifyReader);
