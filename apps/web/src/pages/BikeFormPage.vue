<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { BIKE_TYPE_LABELS, bikeTypeSchema } from '@fitmybike/shared';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import FieldError from '@/components/ui/FieldError.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { buttonVariants } from '@/components/ui/button-variants';
import { ApiError, api, unwrap } from '@/lib/api';
import {
  bikeFormSchema,
  emptyBikeForm,
  toApiPayload,
  toFormValues,
  type BikeApiPayload,
} from './bike-form-schema';

/** Either `customerId` (creating) or `id` (editing) is present, never both. */
const props = defineProps<{ customerId?: string; id?: string }>();

const router = useRouter();
const queryClient = useQueryClient();

const isEdit = computed(() => Boolean(props.id));
const formError = ref<string | null>(null);

const bikeTypes = bikeTypeSchema.options;

const { handleSubmit, errors, defineField, setValues, setErrors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(bikeFormSchema),
  initialValues: emptyBikeForm,
});

const [brand, brandAttrs] = defineField('brand');
const [model, modelAttrs] = defineField('model');
const [sizeLabel, sizeLabelAttrs] = defineField('sizeLabel');
const [type, typeAttrs] = defineField('type');
const [notes, notesAttrs] = defineField('notes');

const existing = useQuery({
  queryKey: ['bike', computed(() => props.id)],
  queryFn: () => unwrap(api.GET('/api/bikes/{id}', { params: { path: { id: props.id as string } } })),
  enabled: computed(() => Boolean(props.id)),
});

watch(
  () => existing.data.value,
  (bike) => {
    if (bike) setValues(toFormValues(bike));
  },
  { immediate: true },
);

/** Where to return to: known up front when creating, from the loaded bike when editing. */
const ownerId = computed(() => props.customerId ?? existing.data.value?.customerId ?? null);

const save = useMutation({
  mutationFn: (values: BikeApiPayload) =>
    props.id
      ? unwrap(api.PATCH('/api/bikes/{id}', { params: { path: { id: props.id } }, body: values }))
      : unwrap(
          api.POST('/api/customers/{customerId}/bikes', {
            params: { path: { customerId: props.customerId as string } },
            body: values,
          }),
        ),
  onSuccess: async (bike) => {
    await queryClient.invalidateQueries({ queryKey: ['bikes'] });
    await router.push({ name: 'customer-detail', params: { id: bike.customerId } });
  },
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.details) {
      const mapped: Record<string, string> = {};
      for (const [field, messages] of Object.entries(error.details)) {
        if (messages[0]) mapped[field] = messages[0];
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
    <header class="mb-6">
      <h1 class="text-xl font-semibold">{{ isEdit ? 'Edit bike' : 'Add bike' }}</h1>
      <p class="text-sm text-muted-foreground">
        Nothing here is required — an unbadged frame is still a bike.
      </p>
    </header>

    <p v-if="isEdit && existing.isPending.value" class="text-sm text-muted-foreground">Loading…</p>

    <Card v-else class="p-6">
      <form class="space-y-5" novalidate @submit="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="brand">Brand</Label>
            <Input
              id="brand"
              v-model="brand"
              v-bind="brandAttrs"
              :invalid="Boolean(errors.brand)"
              data-testid="bike-brand"
            />
            <FieldError :message="errors.brand" />
          </div>

          <div class="space-y-1.5">
            <Label for="model">Model</Label>
            <Input
              id="model"
              v-model="model"
              v-bind="modelAttrs"
              :invalid="Boolean(errors.model)"
              data-testid="bike-model"
            />
            <FieldError :message="errors.model" />
          </div>

          <div class="space-y-1.5">
            <Label for="sizeLabel">Frame size</Label>
            <Input
              id="sizeLabel"
              v-model="sizeLabel"
              v-bind="sizeLabelAttrs"
              placeholder="56, M, 54cm…"
              :invalid="Boolean(errors.sizeLabel)"
            />
            <FieldError :message="errors.sizeLabel" />
          </div>

          <div class="space-y-1.5">
            <Label for="type">Type</Label>
            <select
              id="type"
              v-model="type"
              v-bind="typeAttrs"
              data-testid="bike-type"
              class="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="option in bikeTypes" :key="option" :value="option">
                {{ BIKE_TYPE_LABELS[option] }}
              </option>
            </select>
            <FieldError :message="errors.type" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="notes">Notes</Label>
          <textarea
            id="notes"
            v-model="notes"
            v-bind="notesAttrs"
            rows="4"
            class="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          <FieldError :message="errors.notes" />
        </div>

        <p
          v-if="formError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
          data-testid="form-error"
        >
          {{ formError }}
        </p>

        <div class="flex items-center gap-3">
          <Button
            type="submit"
            :disabled="isSubmitting || save.isPending.value"
            data-testid="save-bike"
          >
            {{ save.isPending.value ? 'Saving…' : 'Save bike' }}
          </Button>
          <RouterLink
            v-if="ownerId"
            :to="{ name: 'customer-detail', params: { id: ownerId } }"
            :class="buttonVariants({ variant: 'outline' })"
          >
            Cancel
          </RouterLink>
        </div>
      </form>
    </Card>
  </div>
</template>
