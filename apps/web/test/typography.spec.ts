/**
 * Reads source files off disk, so it runs in node rather than the project-wide
 * jsdom default — under jsdom `import.meta.url` is not a file URL.
 *
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const css = read('../src/style.css');
const main = read('../src/main.ts');
const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };

describe('type system', () => {
  it('self-hosts both font families rather than reaching for a CDN', () => {
    expect(pkg.dependencies['@fontsource-variable/archivo']).toBeDefined();
    expect(pkg.dependencies['@fontsource-variable/jetbrains-mono']).toBeDefined();
    expect(main).toContain('@fontsource-variable/archivo/standard.css');
    expect(main).toContain('@fontsource-variable/jetbrains-mono');
  });

  it('imports the standard Archivo file, the one carrying the width axis', () => {
    // index.css ships weight only; the expanded display needs wdth 62-125.
    expect(main).not.toContain('@fontsource-variable/archivo/index.css');
  });

  it('defines the three type roles', () => {
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-sans');
    expect(css).toContain('--font-mono');
  });

  it('gives the display role its expanded width', () => {
    expect(css).toMatch(/\.type-display\s*\{[^}]*font-stretch:\s*125%/);
  });

  it('sets numbers tabular so columns of measurements align', () => {
    expect(css).toMatch(/\.type-data\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it('capitalises the eyebrow in CSS, keeping sentence case in the DOM', () => {
    expect(css).toMatch(/\.type-eyebrow\s*\{[^}]*text-transform:\s*uppercase/);
  });
});
