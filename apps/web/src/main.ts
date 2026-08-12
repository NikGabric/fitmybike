import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
// `standard.css` is the file carrying both axes: font-weight 100-900 AND
// font-stretch 62%-125%. `index.css` is weight-only and would silently
// collapse the expanded display back to normal width.
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/jetbrains-mono';
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
