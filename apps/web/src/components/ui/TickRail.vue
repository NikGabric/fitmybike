<script setup lang="ts">
import { cn } from '@/lib/utils';

withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical'; class?: string }>(), {
  orientation: 'horizontal',
  class: undefined,
});
</script>

<template>
  <div
    :class="cn('tick-rail', orientation === 'vertical' && 'tick-rail-vertical', $props.class)"
    aria-hidden="true"
  />
</template>
