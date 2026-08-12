<script setup lang="ts">
import { cn } from '@/lib/utils';

/** `mono` sets numeric fields in the data face, so what the fitter types
 *  aligns with what the list renders back. */
defineProps<{ class?: string; invalid?: boolean; mono?: boolean }>();
const model = defineModel<string | number | null>();
</script>

<template>
  <input
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'flex h-9 w-full rounded-card border border-input bg-card px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        mono && 'type-data',
        invalid && 'border-destructive focus-visible:ring-destructive',
        $props.class,
      )
    "
  />
</template>
