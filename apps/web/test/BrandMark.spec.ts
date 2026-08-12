import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BrandMark from '@/components/BrandMark.vue';

describe('BrandMark', () => {
  it('renders an inline svg, so it needs no network request', () => {
    const wrapper = mount(BrandMark);
    expect(wrapper.element.tagName.toLowerCase()).toBe('svg');
  });

  it('is hidden from assistive tech, always sitting beside the wordmark', () => {
    const wrapper = mount(BrandMark);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('draws five graduated ticks with the third reading the accent', () => {
    const wrapper = mount(BrandMark);
    const ticks = wrapper.findAll('rect');
    expect(ticks).toHaveLength(5);
    expect(ticks[2]!.attributes('fill')).toBe('var(--primary)');
  });

  it('accepts a sizing class', () => {
    const wrapper = mount(BrandMark, { props: { class: 'size-5' } });
    expect(wrapper.classes()).toContain('size-5');
  });
});
