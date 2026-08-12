import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}));

const login = vi.fn();
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ login }),
}));

import { ApiError } from '@/lib/api';
import LoginPage from '@/pages/LoginPage.vue';

function mountPage() {
  return mount(LoginPage, { global: { stubs: { BrandMark: true, TickRail: true } } });
}

/**
 * vee-validate's submit handler runs several async hops before it settles, and
 * @vue/test-utils' trigger() does not await the promise it returns. Draining
 * microtasks alone is not enough — the run has to cross a macrotask boundary.
 */
async function settle(): Promise<void> {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
}

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('blocks submission and shows a message when the email is malformed', async () => {
    const wrapper = mountPage();

    await wrapper.find('#email').setValue('not-an-email');
    await wrapper.find('#password').setValue('changeme123');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(login).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Invalid email address');
  });

  it('submits valid credentials and redirects', async () => {
    login.mockResolvedValueOnce(undefined);
    const wrapper = mountPage();

    await wrapper.find('#email').setValue('owner@fitmybike.test');
    await wrapper.find('#password').setValue('changeme123');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(login).toHaveBeenCalledWith('owner@fitmybike.test', 'changeme123');
    expect(push).toHaveBeenCalled();
  });

  it('surfaces the API message when the credentials are rejected', async () => {
    login.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'));
    const wrapper = mountPage();

    await wrapper.find('#email').setValue('owner@fitmybike.test');
    await wrapper.find('#password').setValue('wrong');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(wrapper.find('[data-testid="login-error"]').text()).toBe('Invalid email or password');
    expect(push).not.toHaveBeenCalled();
  });

  it('reports a transport failure without leaking the raw error', async () => {
    login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const wrapper = mountPage();

    await wrapper.find('#email').setValue('owner@fitmybike.test');
    await wrapper.find('#password').setValue('changeme123');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(wrapper.find('[data-testid="login-error"]').text()).toContain('Could not reach');
  });

  it('leads with the brand mark rather than a stock glyph', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.findComponent({ name: 'BrandMark' }).exists()).toBe(true);
  });

  it('rules the card edge with the tick-rail', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.find('.tick-rail').exists()).toBe(true);
  });
});
