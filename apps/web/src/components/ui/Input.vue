<script setup lang="ts">
import { cn } from '@/lib/utils';

defineProps<{ class?: string; invalid?: boolean }>();
const model = defineModel<string | number | null>();
</script>

<template>
  <input
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive focus-visible:ring-destructive',
        $props.class,
      )
    "
  />
</template>
