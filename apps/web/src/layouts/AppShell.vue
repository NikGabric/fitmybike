<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { Bike, LogOut, Users } from 'lucide-vue-next';
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
      <div class="flex items-center gap-2 px-5 py-5">
        <Bike class="size-5 text-primary" aria-hidden="true" />
        <span class="text-sm font-semibold">Fit My Bike</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 px-3">
        <RouterLink
          :to="{ name: 'customers' }"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          active-class="bg-muted font-medium"
        >
          <Users class="size-4" aria-hidden="true" />
          Customers
        </RouterLink>
      </nav>

      <div class="border-t border-border px-5 py-4">
        <p class="truncate text-xs text-muted-foreground">
          {{ auth.organization?.name }}
        </p>
        <p class="mt-1 truncate text-sm font-medium">{{ auth.user?.name }}</p>
        <p class="truncate text-xs text-muted-foreground">{{ auth.user?.role }}</p>
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
