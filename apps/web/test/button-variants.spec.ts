import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button-variants';

describe('buttonVariants', () => {
  it('puts graphite on the orange fill, never white', () => {
    // White on the accent is 3.0:1 and fails. Graphite is 5.3:1, and is how
    // hi-viz labelling actually works.
    expect(buttonVariants()).toContain('bg-primary');
    expect(buttonVariants()).toContain('text-primary-foreground');
  });

  it('outlines with the control-edge token, not the faint row rule', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border-input');
    expect(buttonVariants({ variant: 'outline' })).not.toContain('border-border');
  });

  it('offers no destructive variant, since fill is reserved for the accent', () => {
    // @ts-expect-error — the variant is gone from the type as well as the CSS.
    expect(buttonVariants({ variant: 'destructive' })).not.toContain('bg-destructive');
  });

  it('keeps a visible focus ring', () => {
    expect(buttonVariants()).toContain('focus-visible:ring-2');
    expect(buttonVariants()).toContain('focus-visible:ring-ring');
  });
});
