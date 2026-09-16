export type EnglishAlgorithm = {
  excludeCommonShortWords: boolean;
  sizes: number[];
  restRatio: number;
};

export type ChineseSettings = {
  gap: number;
  highlight: number;
  gapOpacity: number;
  boldWeight: number;
  intensity: 1 | 2 | 3;
  startHighlighted: boolean;
};

export type BionifyConfig = {
  english: EnglishAlgorithm;
  chinese: ChineseSettings;
  englishRestOpacity: number;
  englishBoldWeight: number;
  colorEnabled: boolean;
  color: string;
};

export const DEFAULT_ENGLISH_ALGORITHM = '- 0 1 1 2 0.4';
export const DEFAULT_CHINESE_SETTINGS = '5 2 0.8 0.2 2';

const COMMON_SHORT_WORDS = new Set([
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'an',
  'it',
  'at',
  'on',
  'he',
  'she',
  'but',
  'is',
  'my',
]);

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseEnglishAlgorithm(value: unknown): EnglishAlgorithm {
  const raw = String(value ?? DEFAULT_ENGLISH_ALGORITHM).trim();
  const parts = raw.split(/\s+/);

  if (parts.length < 3 || (parts[0] !== '-' && parts[0] !== '+')) {
    if (raw === DEFAULT_ENGLISH_ALGORITHM) {
      return {
        excludeCommonShortWords: true,
        sizes: [0, 1, 1, 2],
        restRatio: 0.4,
      };
    }
    return parseEnglishAlgorithm(DEFAULT_ENGLISH_ALGORITHM);
  }

  const sizes = parts.slice(1, -1).map(Number);
  const restRatio = Number(parts[parts.length - 1]);

  if (
    sizes.length === 0 ||
    sizes.some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isFinite(restRatio) ||
    restRatio < 0 ||
    restRatio > 1
  ) {
    return parseEnglishAlgorithm(DEFAULT_ENGLISH_ALGORITHM);
  }

  return {
    excludeCommonShortWords: parts[0] === '-',
    sizes: sizes.map((n) => Math.floor(n)),
    restRatio,
  };
}

export function parseChineseSettings(value: unknown): ChineseSettings {
  const raw = String(value ?? DEFAULT_CHINESE_SETTINGS).trim();
  let numbers = raw.split(/\s+/).map(Number);

  // Backward-compatible 4-value format:
  // Gap Highlight GapOpacity Intensity
  if (numbers.length === 4) {
    numbers = [numbers[0], numbers[1], numbers[2], 0.2, numbers[3]];
  }

  const valid =
    numbers.length === 5 &&
    Number.isInteger(numbers[0]) &&
    numbers[0] >= 0 &&
    Number.isInteger(numbers[1]) &&
    numbers[1] > 0 &&
    Number.isFinite(numbers[2]) &&
    numbers[2] >= 0 &&
    numbers[2] <= 1 &&
    Number.isFinite(numbers[3]) &&
    numbers[3] >= 0 &&
    numbers[3] <= 1 &&
    Number.isInteger(numbers[4]) &&
    numbers[4] >= 1 &&
    numbers[4] <= 3;

  if (!valid) {
    if (raw === DEFAULT_CHINESE_SETTINGS) {
      return {
        gap: 5,
        highlight: 2,
        gapOpacity: 0.8,
        boldWeight: 0.2,
        intensity: 2,
        startHighlighted: true,
      };
    }
    return parseChineseSettings(DEFAULT_CHINESE_SETTINGS);
  }

  return {
    gap: numbers[0],
    highlight: numbers[1],
    gapOpacity: numbers[2],
    boldWeight: numbers[3],
    intensity: numbers[4] as 1 | 2 | 3,
    startHighlighted: true,
  };
}

export function getWordHighlightLength(
  word: string,
  algorithm: EnglishAlgorithm
): number {
  if (
    word.length <= 3 &&
    algorithm.excludeCommonShortWords &&
    COMMON_SHORT_WORDS.has(word.toLowerCase())
  ) {
    return 0;
  }

  const index = word.length - 1;
  if (index < algorithm.sizes.length) {
    return clamp(algorithm.sizes[index] ?? 0, 0, word.length);
  }

  return clamp(Math.ceil(word.length * algorithm.restRatio), 0, word.length);
}

export function isCjkCharacter(char: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(
    char
  );
}

export function safeColor(value: unknown): string {
  const color = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#11b500';
}
