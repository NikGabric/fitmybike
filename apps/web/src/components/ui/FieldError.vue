<script setup lang="ts">
defineProps<{ message?: string | undefined }>();
</script>

<template>
  <p v-if="message" class="text-xs text-destructive" role="alert">{{ message }}</p>
</template>
