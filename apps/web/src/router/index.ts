import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    children: [
      { path: '', redirect: { name: 'customers' } },
      {
        path: 'customers',
        name: 'customers',
        component: () => import('@/pages/CustomersPage.vue'),
      },
      {
        path: 'customers/new',
        name: 'customer-new',
        component: () => import('@/pages/CustomerFormPage.vue'),
      },
      {
        path: 'customers/:id',
        name: 'customer-detail',
        component: () => import('@/pages/CustomerDetailPage.vue'),
        props: true,
      },
      {
        path: 'customers/:id/edit',
        name: 'customer-edit',
        component: () => import('@/pages/CustomerFormPage.vue'),
        props: true,
      },
      {
        path: 'customers/:customerId/bikes/new',
        name: 'bike-new',
        component: () => import('@/pages/BikeFormPage.vue'),
        props: true,
      },
      {
        path: 'bikes/:id/edit',
        name: 'bike-edit',
        component: () => import('@/pages/BikeFormPage.vue'),
        props: true,
      },
      {
        path: 'fits/:id',
        name: 'fit',
        component: () => import('@/pages/FitWizardPage.vue'),
        props: true,
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'customers' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  // One /auth/me per page load; the store short-circuits afterwards.
  await auth.bootstrap();

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.isAuthenticated) {
    return { name: 'customers' };
  }
  return true;
});
