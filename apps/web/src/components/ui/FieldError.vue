<script setup lang="ts">
defineProps<{ message?: string | undefined }>();
</script>

<template>
  <p v-if="message" class="type-data text-xs text-destructive" role="alert">{{ message }}</p>
</template>
