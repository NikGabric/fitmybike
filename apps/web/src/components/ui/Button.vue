<script setup lang="ts">
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonVariants } from './button-variants';

withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    class?: string;
  }>(),
  { type: 'button', disabled: false, variant: 'default', size: 'default', class: undefined },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="cn(buttonVariants({ variant, size }), $props.class)"
  >
    <slot />
  </button>
</template>
