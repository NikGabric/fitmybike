<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import FieldError from '@/components/ui/FieldError.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import TickRail from '@/components/ui/TickRail.vue';
import { buttonVariants } from '@/components/ui/button-variants';
import { ApiError, api, unwrap } from '@/lib/api';
import {
  customerFormSchema,
  emptyCustomerForm,
  toApiPayload,
  toFormValues,
  type CustomerApiPayload,
} from './customer-form-schema';

const props = defineProps<{ id?: string }>();

const router = useRouter();
const queryClient = useQueryClient();

const isEdit = computed(() => Boolean(props.id));
const formError = ref<string | null>(null);

const { handleSubmit, errors, defineField, setValues, setErrors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(customerFormSchema),
  initialValues: emptyCustomerForm,
});

const [firstName, firstNameAttrs] = defineField('firstName');
const [lastName, lastNameAttrs] = defineField('lastName');
const [email, emailAttrs] = defineField('email');
const [phone, phoneAttrs] = defineField('phone');
const [dateOfBirth, dateOfBirthAttrs] = defineField('dateOfBirth');
const [heightCm, heightCmAttrs] = defineField('heightCm');
const [weightKg, weightKgAttrs] = defineField('weightKg');
const [notes, notesAttrs] = defineField('notes');

const existing = useQuery({
  queryKey: ['customer', computed(() => props.id)],
  queryFn: () =>
    unwrap(api.GET('/api/customers/{id}', { params: { path: { id: props.id as string } } })),
  enabled: computed(() => Boolean(props.id)),
});

watch(
  () => existing.data.value,
  (customer) => {
    if (customer) setValues(toFormValues(customer));
  },
  { immediate: true },
);

const save = useMutation({
  mutationFn: (values: CustomerApiPayload) =>
    props.id
      ? unwrap(
          api.PATCH('/api/customers/{id}', {
            params: { path: { id: props.id } },
            body: values,
          }),
        )
      : unwrap(api.POST('/api/customers', { body: values })),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
    await router.push({ name: 'customers' });
  },
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.details) {
      // Map server-side field errors back onto the form. Field names match because
      // both sides derive from the same schema — except the unit-converted pair.
      const mapped: Record<string, string> = {};
      for (const [field, messages] of Object.entries(error.details)) {
        const target =
          field === 'heightMm' ? 'heightCm' : field === 'weightGrams' ? 'weightKg' : field;
        if (messages[0]) mapped[target] = messages[0];
      }
      setErrors(mapped);
      formError.value = 'Please correct the highlighted fields.';
      return;
    }
    formError.value =
      error instanceof ApiError ? error.message : 'Could not save. Please try again.';
  },
});

const onSubmit = handleSubmit((values) => {
  formError.value = null;
  save.mutate(toApiPayload(values));
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <header class="mb-4">
      <h1 class="type-display text-lg uppercase tracking-[0.06em]">
        {{ isEdit ? 'Edit customer' : 'New customer' }}
      </h1>
      <p class="type-eyebrow mt-1 text-muted-foreground">
        Measurements are stored in millimetres and grams; enter them in cm and kg.
      </p>
    </header>

    <TickRail class="mb-6" />

    <p v-if="isEdit && existing.isPending.value" class="text-sm text-muted-foreground">Loading…</p>

    <Card v-else class="p-6">
      <form class="space-y-5" novalidate @submit="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="firstName">First name</Label>
            <Input
              id="firstName"
              v-model="firstName"
              v-bind="firstNameAttrs"
              :invalid="Boolean(errors.firstName)"
              data-testid="firstName"
            />
            <FieldError :message="errors.firstName" />
          </div>

          <div class="space-y-1.5">
            <Label for="lastName">Last name</Label>
            <Input
              id="lastName"
              v-model="lastName"
              v-bind="lastNameAttrs"
              :invalid="Boolean(errors.lastName)"
              data-testid="lastName"
            />
            <FieldError :message="errors.lastName" />
          </div>

          <div class="space-y-1.5">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              :invalid="Boolean(errors.email)"
              data-testid="email"
            />
            <FieldError :message="errors.email" />
          </div>

          <div class="space-y-1.5">
            <Label for="phone">Phone</Label>
            <Input id="phone" v-model="phone" v-bind="phoneAttrs" :invalid="Boolean(errors.phone)" />
            <FieldError :message="errors.phone" />
          </div>

          <div class="space-y-1.5">
            <Label for="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              v-model="dateOfBirth"
              v-bind="dateOfBirthAttrs"
              type="date"
              mono
              :invalid="Boolean(errors.dateOfBirth)"
            />
            <FieldError :message="errors.dateOfBirth" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <Label for="heightCm">Height (cm)</Label>
              <Input
                id="heightCm"
                v-model="heightCm"
                v-bind="heightCmAttrs"
                type="number"
                step="0.1"
                mono
                :invalid="Boolean(errors.heightCm)"
                data-testid="heightCm"
              />
              <FieldError :message="errors.heightCm" />
            </div>

            <div class="space-y-1.5">
              <Label for="weightKg">Weight (kg)</Label>
              <Input
                id="weightKg"
                v-model="weightKg"
                v-bind="weightKgAttrs"
                type="number"
                step="0.1"
                mono
                :invalid="Boolean(errors.weightKg)"
              />
              <FieldError :message="errors.weightKg" />
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="notes">Notes</Label>
          <textarea
            id="notes"
            v-model="notes"
            v-bind="notesAttrs"
            rows="4"
            class="flex w-full rounded-card border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          <FieldError :message="errors.notes" />
        </div>

        <p
          v-if="formError"
          class="type-data rounded-card border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
          data-testid="form-error"
        >
          {{ formError }}
        </p>

        <div class="flex items-center gap-3">
          <Button type="submit" :disabled="isSubmitting || save.isPending.value" data-testid="save">
            {{ save.isPending.value ? 'Saving…' : 'Save customer' }}
          </Button>
          <RouterLink :to="{ name: 'customers' }" :class="buttonVariants({ variant: 'outline' })">
            Cancel
          </RouterLink>
        </div>
      </form>
    </Card>
  </div>
</template>
