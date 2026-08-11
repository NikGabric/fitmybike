<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { loginSchema } from '@fitmybike/shared';
import { Bike } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import FieldError from '@/components/ui/FieldError.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const formError = ref<string | null>(null);
const submitting = ref(false);

// The very same schema the API validates against — imported, not re-declared.
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(loginSchema),
});

const [email, emailAttrs] = defineField('email');
const [password, passwordAttrs] = defineField('password');

const onSubmit = handleSubmit(async (values) => {
  formError.value = null;
  submitting.value = true;
  try {
    await auth.login(values.email, values.password);
    const redirect = route.query['redirect'];
    await router.push(typeof redirect === 'string' ? redirect : { name: 'customers' });
  } catch (error) {
    formError.value =
      error instanceof ApiError ? error.message : 'Could not reach the server. Try again.';
  } finally {
    submitting.value = false;
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm p-6">
      <div class="mb-6 flex items-center gap-2">
        <Bike class="size-5 text-primary" aria-hidden="true" />
        <h1 class="text-lg font-semibold">Fit My Bike</h1>
      </div>

      <form class="space-y-4" novalidate @submit="onSubmit">
        <div class="space-y-1.5">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            autocomplete="username"
            :invalid="Boolean(errors.email)"
          />
          <FieldError :message="errors.email" />
        </div>

        <div class="space-y-1.5">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="current-password"
            :invalid="Boolean(errors.password)"
          />
          <FieldError :message="errors.password" />
        </div>

        <p
          v-if="formError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
          data-testid="login-error"
        >
          {{ formError }}
        </p>

        <Button type="submit" class="w-full" :disabled="submitting" data-testid="login-submit">
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </Button>
      </form>
    </Card>
  </div>
</template>
