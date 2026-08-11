import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import './style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fitters keep the app open all day; refetching on focus keeps a shared
      // customer list from going stale between colleagues.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createApp(App)
  .use(createPinia())
  .use(router)
  .use(VueQueryPlugin, { queryClient })
  .mount('#app');
