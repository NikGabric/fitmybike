<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { LogOut, Users } from 'lucide-vue-next';
import BrandMark from '@/components/BrandMark.vue';
import Button from '@/components/ui/Button.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="hidden w-60 shrink-0 flex-col border-r border-border bg-card sm:flex">
      <div class="flex items-center gap-2.5 px-5 py-5">
        <BrandMark class="size-5 text-muted-foreground" />
        <span class="type-display text-sm uppercase tracking-[0.1em]">Fit My Bike</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 px-3">
        <!-- The orange rail comes from `.nav-item.is-active::before`, so the
             active class does the work without a wrapper element. -->
        <RouterLink
          :to="{ name: 'customers' }"
          class="nav-item flex items-center gap-2 rounded-card py-2 pl-4 pr-3 text-sm transition-colors hover:bg-muted"
          active-class="is-active bg-muted font-medium"
        >
          <Users class="size-4" aria-hidden="true" />
          Customers
        </RouterLink>
      </nav>

      <div class="border-t border-border px-5 py-4">
        <p class="type-eyebrow truncate text-muted-foreground">
          {{ auth.organization?.name }}
        </p>
        <p class="mt-1.5 truncate text-sm font-medium">{{ auth.user?.name }}</p>
        <p class="type-eyebrow mt-0.5 truncate text-muted-foreground">{{ auth.user?.role }}</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3 w-full"
          data-testid="logout"
          @click="handleLogout"
        >
          <LogOut class="size-3.5" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </aside>

    <main class="flex-1 overflow-x-auto px-6 py-6 sm:px-8">
      <RouterView />
    </main>
  </div>
</template>
