<script setup lang="ts">
/**
 * A scale with a reading on it: five graduated ticks, the third full height
 * and orange. Same logic as the tick-rail, so mark and interface share a
 * vocabulary. Legible down to 16px, which is what makes it work as a favicon.
 *
 * The comment lives here rather than in the template because a comment node
 * there would make this a fragment, and fallthrough attributes would stop
 * reaching the <svg>.
 */
import { cn } from '@/lib/utils';

defineProps<{ class?: string }>();
</script>

<template>
  <svg
    :class="cn('size-5', $props.class)"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="1" y="10" width="2" height="8" />
    <rect x="5" y="7" width="2" height="11" />
    <rect x="9" y="2" width="2" height="16" fill="var(--primary)" />
    <rect x="13" y="7" width="2" height="11" />
    <rect x="17" y="10" width="2" height="8" />
  </svg>
</template>
