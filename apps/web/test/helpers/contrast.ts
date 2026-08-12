/**
 * WCAG contrast for oklch tokens read straight out of style.css.
 *
 * The palette is authored in oklch, but WCAG 2.1 relative luminance is defined
 * on linear sRGB, so we convert rather than eyeball. Keeping this in the test
 * suite means the palette is a verified artifact: nudging a token until it
 * "looks right" fails the build if it drops below its floor.
 */

/** Splits style.css into the light `:root` block and the dark media-query block. */
export function extractTokens(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const marker = '@media (prefers-color-scheme: dark)';
  const index = css.indexOf(marker);
  if (index === -1) throw new Error('no dark-mode block found in style.css');

  // Values in `@theme inline` are `var(...)`, not `oklch(...)`, so they are
  // skipped by the pattern below and cannot pollute either bucket.
  return {
    light: readOklchDecls(css.slice(0, index)),
    dark: readOklchDecls(css.slice(index)),
  };
}

function readOklchDecls(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pattern = /--([a-z-]+):\s*(oklch\([^)]*\))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    out[match[1]!] = match[2]!;
  }
  return out;
}

/** `oklch(92.5% 0.007 150)` -> `[0.925, 0.007, 150]`. Accepts L as % or 0-1. */
export function parseOklch(value: string): [number, number, number] {
  const body = value.trim().replace(/^oklch\(/, '').replace(/\)$/, '');
  const parts = body.split(/[\s/]+/).filter(Boolean);
  if (parts.length < 3) throw new Error(`cannot parse ${value}`);

  const rawL = parts[0]!;
  const l = rawL.endsWith('%') ? Number.parseFloat(rawL) / 100 : Number.parseFloat(rawL);
  return [l, Number.parseFloat(parts[1]!), Number.parseFloat(parts[2]!)];
}

/** Oklab -> linear sRGB. Not clamped here; `relativeLuminance` clamps. */
export function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ];
}

function relativeLuminance(value: string): number {
  const [r, g, b] = oklchToLinearSrgb(...parseOklch(value));
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [hi, lo] = first > second ? [first, second] : [second, first];
  return (hi + 0.05) / (lo + 0.05);
}
