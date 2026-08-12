<script setup lang="ts">
/**
 * The sheet on the desk. It sits lighter than the page background, so it
 * separates with a hairline rather than with elevation — hence no shadow.
 */
import { cn } from '@/lib/utils';

defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('rounded-card border border-border bg-card', $props.class)">
    <slot />
  </div>
</template>
