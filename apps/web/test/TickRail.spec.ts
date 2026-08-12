import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TickRail from '@/components/ui/TickRail.vue';

describe('TickRail', () => {
  it('is hidden from assistive technology, being pure decoration', () => {
    const wrapper = mount(TickRail);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('defaults to the horizontal rule used under page headers', () => {
    const wrapper = mount(TickRail);
    expect(wrapper.classes()).toContain('tick-rail');
    expect(wrapper.classes()).not.toContain('tick-rail-vertical');
  });

  it('renders vertically when asked, for the sidebar edge', () => {
    const wrapper = mount(TickRail, { props: { orientation: 'vertical' } });
    expect(wrapper.classes()).toContain('tick-rail-vertical');
  });

  it('merges a caller class without dropping its own', () => {
    const wrapper = mount(TickRail, { props: { class: 'mb-4' } });
    expect(wrapper.classes()).toContain('tick-rail');
    expect(wrapper.classes()).toContain('mb-4');
  });
});
