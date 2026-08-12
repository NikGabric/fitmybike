/**
 * Reads style.css off disk, so it runs in node rather than the project-wide
 * jsdom default — under jsdom `import.meta.url` is not a file URL.
 *
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, extractTokens } from './helpers/contrast';

const css = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');
const { light, dark } = extractTokens(css);

/** [foreground token, background token, minimum ratio, what it is]. */
const PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['foreground', 'card', 4.5, 'body text on the sheet'],
  ['foreground', 'background', 4.5, 'body text on the desk'],
  ['muted-foreground', 'card', 4.5, 'secondary text on the sheet'],
  ['muted-foreground', 'background', 4.5, 'secondary text on the desk'],
  ['accent-ink', 'card', 4.5, 'link and measured value'],
  ['destructive', 'card', 4.5, 'error text'],
  ['primary-foreground', 'primary', 4.5, 'graphite on the orange button'],
  ['foreground', 'muted', 4.5, 'text on a hovered row'],
  ['accent-ink', 'muted', 4.5, 'link on a hovered row'],
  ['muted-foreground', 'muted', 4.5, 'label on a hovered row'],
  ['input', 'card', 3, 'input outline on the sheet'],
  ['input', 'background', 3, 'input outline on the desk'],
  ['ring', 'card', 3, 'focus ring on the sheet'],
  ['ring', 'background', 3, 'focus ring on the desk'],
  ['primary', 'card', 3, 'orange mark on the sheet'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_theme, tokens) => {
  it.each(PAIRS)('%s on %s meets %s:1 — %s', (fg, bg, min) => {
    const foreground = tokens[fg];
    const background = tokens[bg];
    expect(foreground, `missing --${fg}`).toBeDefined();
    expect(background, `missing --${bg}`).toBeDefined();

    expect(contrastRatio(foreground!, background!)).toBeGreaterThanOrEqual(min);
  });
});

it('defines --accent-ink in both themes', () => {
  expect(light['accent-ink']).toBeDefined();
  expect(dark['accent-ink']).toBeDefined();
});

it('drops --destructive-foreground, which nothing renders on any more', () => {
  expect(css).not.toContain('--destructive-foreground');
});
