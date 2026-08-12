<script setup lang="ts">
import { cn } from '@/lib/utils';

defineProps<{ for?: string; class?: string }>();
</script>

<template>
  <label :for="$props.for" :class="cn('type-eyebrow block text-muted-foreground', $props.class)">
    <slot />
  </label>
</template>
