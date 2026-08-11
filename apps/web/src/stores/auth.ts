import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { CurrentUser } from '@fitmybike/shared';
import { api, unwrap } from '@/lib/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null);
  /** False until the first /auth/me has settled, so guards do not redirect early. */
  const initialised = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const organization = computed(() => user.value?.organization ?? null);

  /** Restores the session from the httpOnly cookie on a cold page load. */
  async function bootstrap(): Promise<void> {
    if (initialised.value) return;
    try {
      user.value = await unwrap(api.GET('/api/auth/me'));
    } catch {
      user.value = null;
    } finally {
      initialised.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    user.value = await unwrap(api.POST('/api/auth/login', { body: { email, password } }));
    initialised.value = true;
  }

  async function logout(): Promise<void> {
    try {
      await unwrap(api.POST('/api/auth/logout'));
    } finally {
      user.value = null;
    }
  }

  return { user, initialised, isAuthenticated, organization, bootstrap, login, logout };
});
