<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  bikeLabel,
  formatMeasurement,
  type FitStage,
  type FitStep,
  type MeasurementDefinition,
} from '@fitmybike/shared';
import { ArrowLeft, Check } from 'lucide-vue-next';
import MeasurementGrid, { type GridValue } from '@/components/MeasurementGrid.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import { buttonVariants } from '@/components/ui/button-variants';
import { ApiError, api, unwrap } from '@/lib/api';

const props = defineProps<{ id: string }>();

const router = useRouter();
const queryClient = useQueryClient();

/**
 * The wizard's steps, and the only place the (category, stage) pairing lives.
 *
 * FitStage is BEFORE/AFTER — the two snapshots of the bike — and body measurements
 * have no stage at all. Flattening both into one list of screens is a presentation
 * concern, so it belongs here rather than in the schema.
 */
const STEPS: Array<{
  step: FitStep;
  title: string;
  blurb: string;
  category: 'BODY' | 'BIKE' | null;
  stage: FitStage | null;
}> = [
  {
    step: 'BODY',
    title: 'Body',
    blurb: 'Measure the rider. These carry over to their next fit.',
    category: 'BODY',
    stage: null,
  },
  {
    step: 'BIKE_BEFORE',
    title: 'Bike as it arrived',
    blurb: 'Record the bike before you touch anything.',
    category: 'BIKE',
    stage: 'BEFORE',
  },
  {
    step: 'BIKE_AFTER',
    title: 'Bike as delivered',
    blurb: 'Record the bike once the fit is dialled in.',
    category: 'BIKE',
    stage: 'AFTER',
  },
  { step: 'REVIEW', title: 'Review', blurb: 'What changed, and why.', category: null, stage: null },
];

const gridRef = useTemplateRef<{ flushNow: () => void }>('grid');
const saveErrors = ref<Record<string, string>>({});
const summary = ref('');

const fit = useQuery({
  queryKey: ['fit', computed(() => props.id)],
  queryFn: () => unwrap(api.GET('/api/fits/{id}', { params: { path: { id: props.id } } })),
});

const catalog = useQuery({
  queryKey: ['measurement-definitions'],
  queryFn: () => unwrap(api.GET('/api/measurement-definitions')),
  // The catalog only changes on deploy, so re-fetching it per fit is pure waste.
  staleTime: Infinity,
});

const currentStep = ref<FitStep>('BODY');
const hydrated = ref(false);

/**
 * The server's `currentStep` says where to *resume*; once the wizard is open the
 * fitter drives it. Adopting it on every query update meant a measurement save —
 * whose response still carried the previous step — could yank the wizard backwards
 * mid-navigation, and the next flush would post to the wrong endpoint. Same for the
 * summary, which would otherwise be overwritten while being typed.
 */
watch(
  () => fit.data.value,
  (loaded) => {
    if (!loaded || hydrated.value) return;
    currentStep.value = loaded.currentStep;
    summary.value = loaded.summary ?? '';
    hydrated.value = true;
  },
  { immediate: true },
);

const stepIndex = computed(() => STEPS.findIndex((s) => s.step === currentStep.value));
const step = computed(() => STEPS[stepIndex.value] ?? STEPS[0]);

const definitions = computed<MeasurementDefinition[]>(() => {
  const category = step.value?.category;
  if (!category) return [];
  return (catalog.data.value?.data ?? []).filter((d) => d.category === category);
});

const bodyDefinitions = computed(() =>
  (catalog.data.value?.data ?? []).filter((d) => d.category === 'BODY'),
);
const bikeDefinitions = computed(() =>
  (catalog.data.value?.data ?? []).filter((d) => d.category === 'BIKE'),
);

/** Values for the current step, keyed by measurement key, in stored units. */
const values = computed<Record<string, GridValue>>(() => {
  const loaded = fit.data.value;
  const current = step.value;
  if (!loaded || !current?.category) return {};

  const result: Record<string, GridValue> = {};
  if (current.category === 'BODY') {
    for (const m of loaded.bodyMeasurements) {
      result[m.key] = { value: m.value, prefilled: m.prefilled };
    }
  } else {
    for (const m of loaded.bikeMeasurements) {
      if (m.stage === current.stage) result[m.key] = { value: m.value, prefilled: m.prefilled };
    }
  }
  return result;
});

type MeasurementChange = { key: string; value: number | null };

/**
 * A save carries its own destination.
 *
 * It must not be derived from `currentStep` inside mutationFn: moving between steps
 * flushes the grid and *then* advances the step, and the mutation body runs after
 * that — so reading reactive state there posted each step's last save to the next
 * step's endpoint. The destination is snapshotted synchronously in the emit handler
 * instead.
 */
type SavePayload =
  | { kind: 'body'; measurements: MeasurementChange[] }
  | { kind: 'bike'; stage: FitStage; measurements: MeasurementChange[] };

const saveMeasurements = useMutation({
  mutationFn: (payload: SavePayload) =>
    payload.kind === 'body'
      ? unwrap(
          api.PATCH('/api/fits/{id}/body-measurements', {
            params: { path: { id: props.id } },
            body: { measurements: payload.measurements } as never,
          }),
        )
      : unwrap(
          api.PATCH('/api/fits/{id}/bike-measurements', {
            params: { path: { id: props.id } },
            body: { stage: payload.stage, measurements: payload.measurements } as never,
          }),
        ),
  onSuccess: (updated) => {
    saveErrors.value = {};
    queryClient.setQueryData(['fit', props.id], updated);
  },
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.details) {
      const mapped: Record<string, string> = {};
      for (const [key, messages] of Object.entries(error.details)) {
        if (messages[0]) mapped[key] = messages[0];
      }
      saveErrors.value = mapped;
    }
  },
});

/** Runs synchronously from the grid's emit, while `step` is still the grid's step. */
function onGridSave(changes: MeasurementChange[]): void {
  const current = step.value;
  if (!current?.category) return;

  saveMeasurements.mutate(
    current.category === 'BODY'
      ? { kind: 'body', measurements: changes }
      : { kind: 'bike', stage: current.stage as FitStage, measurements: changes },
  );
}

const saveFit = useMutation({
  mutationFn: (body: { currentStep?: FitStep; summary?: string | null }) =>
    unwrap(api.PATCH('/api/fits/{id}', { params: { path: { id: props.id } }, body })),
  onSuccess: (updated) => queryClient.setQueryData(['fit', props.id], updated),
});

const complete = useMutation({
  mutationFn: () =>
    unwrap(api.POST('/api/fits/{id}/complete', { params: { path: { id: props.id } } })),
  onSuccess: async (updated) => {
    queryClient.setQueryData(['fit', props.id], updated);
    await queryClient.invalidateQueries({ queryKey: ['fits'] });
    await router.push({ name: 'customer-detail', params: { id: updated.customerId } });
  },
});

async function goTo(next: FitStep): Promise<void> {
  // Flush anything still sitting in the debounce, or moving on loses the last field.
  gridRef.value?.flushNow();
  currentStep.value = next;
  // Remembering the step is a convenience; failing to record it must not block the
  // fitter from moving on, and must not surface as an unhandled rejection.
  await saveFit.mutateAsync({ currentStep: next }).catch(() => undefined);
}

const back = (): Promise<void> => goTo(STEPS[Math.max(0, stepIndex.value - 1)]!.step);
const next = (): Promise<void> =>
  goTo(STEPS[Math.min(STEPS.length - 1, stepIndex.value + 1)]!.step);

async function finish(): Promise<void> {
  await saveFit.mutateAsync({ summary: summary.value === '' ? null : summary.value });
  await complete.mutateAsync();
}

/** Review rows: every bike measurement that has a before or an after. */
const comparison = computed(() => {
  const loaded = fit.data.value;
  if (!loaded) return [];

  return bikeDefinitions.value
    .map((definition) => {
      const before = loaded.bikeMeasurements.find(
        (m) => m.key === definition.key && m.stage === 'BEFORE',
      );
      const after = loaded.bikeMeasurements.find(
        (m) => m.key === definition.key && m.stage === 'AFTER',
      );
      if (!before && !after) return null;

      const delta =
        before && after && before.value !== after.value ? after.value - before.value : null;

      return { definition, before: before?.value ?? null, after: after?.value ?? null, delta };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
});

const bodySummary = computed(() => {
  const loaded = fit.data.value;
  if (!loaded) return [];
  return bodyDefinitions.value
    .map((definition) => {
      const held = loaded.bodyMeasurements.find((m) => m.key === definition.key);
      return held ? { definition, value: held.value } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
});

const savingLabel = computed(() => {
  if (saveMeasurements.isPending.value) return 'Saving…';
  if (Object.keys(saveErrors.value).length > 0) return 'Not saved';
  return 'Saved';
});
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <p v-if="fit.isPending.value || catalog.isPending.value" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <p v-else-if="fit.isError.value" class="text-sm text-destructive" data-testid="fit-error">
      {{ fit.error.value?.message ?? 'Could not load this fit' }}
    </p>

    <template v-else-if="fit.data.value && step">
      <RouterLink
        :to="{ name: 'customer-detail', params: { id: fit.data.value.customerId } }"
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        {{ fit.data.value.customer.firstName }} {{ fit.data.value.customer.lastName }}
      </RouterLink>

      <header class="mb-5">
        <h1 class="text-xl font-semibold">{{ bikeLabel(fit.data.value.bike) }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ fit.data.value.reason ?? 'Fit session' }}
        </p>
      </header>

      <!-- Stepper -->
      <ol class="mb-6 flex flex-wrap gap-2" data-testid="fit-steps">
        <li v-for="(item, index) in STEPS" :key="item.step">
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition-colors"
            :class="
              index === stepIndex
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted'
            "
            :aria-current="index === stepIndex ? 'step' : undefined"
            :data-testid="`step-${item.step}`"
            @click="goTo(item.step)"
          >
            {{ index + 1 }}. {{ item.title }}
          </button>
        </li>
      </ol>

      <Card class="p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="font-medium">{{ step.title }}</h2>
            <p class="text-sm text-muted-foreground">{{ step.blurb }}</p>
          </div>
          <span
            v-if="step.category"
            class="shrink-0 text-xs text-muted-foreground"
            data-testid="save-state"
          >
            {{ savingLabel }}
          </span>
        </div>

        <MeasurementGrid
          v-if="step.category"
          ref="grid"
          :key="step.step"
          :definitions="definitions"
          :values="values"
          :errors="saveErrors"
          :saving="saveMeasurements.isPending.value"
          @save="onGridSave"
        />

        <!-- Review -->
        <div v-else class="space-y-6">
          <section>
            <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Bike changes
            </h3>
            <p v-if="!comparison.length" class="text-sm text-muted-foreground">
              No bike measurements recorded.
            </p>
            <table v-else class="w-full text-sm" data-testid="comparison-table">
              <thead class="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" class="py-2 font-medium">Measurement</th>
                  <th scope="col" class="py-2 text-right font-medium">Before</th>
                  <th scope="col" class="py-2 text-right font-medium">After</th>
                  <th scope="col" class="py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in comparison"
                  :key="row.definition.key"
                  class="border-b border-border last:border-0"
                  :data-testid="`row-${row.definition.key}`"
                >
                  <td class="py-2">{{ row.definition.label }}</td>
                  <td class="py-2 text-right tabular-nums text-muted-foreground">
                    {{ formatMeasurement(row.before, row.definition.unit) }}
                  </td>
                  <td class="py-2 text-right tabular-nums font-medium">
                    {{ formatMeasurement(row.after, row.definition.unit) }}
                  </td>
                  <td
                    class="py-2 text-right tabular-nums"
                    :class="row.delta ? 'text-primary' : 'text-muted-foreground'"
                  >
                    <template v-if="row.delta">
                      {{ row.delta > 0 ? '+' : ''
                      }}{{ formatMeasurement(row.delta, row.definition.unit) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section v-if="bodySummary.length">
            <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Body
            </h3>
            <dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div v-for="row in bodySummary" :key="row.definition.key" class="flex justify-between">
                <dt class="text-muted-foreground">{{ row.definition.label }}</dt>
                <dd class="tabular-nums">
                  {{ formatMeasurement(row.value, row.definition.unit) }}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <label
              for="summary"
              class="mb-2 block text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Summary for the customer
            </label>
            <textarea
              id="summary"
              v-model="summary"
              rows="4"
              data-testid="fit-summary"
              class="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
          </section>
        </div>

        <div class="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="outline" :disabled="stepIndex === 0" @click="back">Back</Button>

          <Button v-if="stepIndex < STEPS.length - 1" data-testid="fit-next" @click="next">
            Next
          </Button>

          <Button
            v-else
            :disabled="complete.isPending.value"
            data-testid="fit-complete"
            @click="finish"
          >
            <Check class="size-4" aria-hidden="true" />
            {{
              fit.data.value.status === 'COMPLETED'
                ? 'Save and close'
                : complete.isPending.value
                  ? 'Completing…'
                  : 'Complete fit'
            }}
          </Button>
        </div>
      </Card>

      <p v-if="fit.data.value.status === 'COMPLETED'" class="mt-4 text-xs text-muted-foreground">
        This fit is complete. Changes are still saved — correcting a number afterwards is
        expected.
      </p>

      <RouterLink
        :to="{ name: 'customer-detail', params: { id: fit.data.value.customerId } }"
        :class="[buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-2']"
      >
        Leave and come back later
      </RouterLink>
    </template>
  </div>
</template>
