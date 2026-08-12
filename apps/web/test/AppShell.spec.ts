import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div />' },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
    user: { name: 'Ana Horvat', role: 'OWNER' },
    organization: { name: 'Fit My Bike' },
  }),
}));

import AppShell from '@/layouts/AppShell.vue';

describe('AppShell', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('leads with the brand mark, not an off-the-shelf glyph', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.findComponent({ name: 'BrandMark' }).exists()).toBe(true);
  });

  it('sets the wordmark in the display face', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('.type-display').text()).toContain('Fit My Bike');
  });

  it('marks the nav item so the active one can grow its orange rail', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('.nav-item').exists()).toBe(true);
  });

  it('keeps the logout control addressable by its test id', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('[data-testid="logout"]').exists()).toBe(true);
  });
});
