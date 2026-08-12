<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MeasurementDefinition } from '@fitmybike/shared';
import FieldError from '@/components/ui/FieldError.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import {
  displayBounds,
  parseEntry,
  toDisplayValue,
  unitLabel,
  unitStep,
} from '@/lib/measurement-fields';

/** One measurement as the server holds it. */
export interface GridValue {
  value: number;
  prefilled: boolean;
}

const props = defineProps<{
  definitions: MeasurementDefinition[];
  /** Keyed by measurement key, in stored units. */
  values: Record<string, GridValue>;
  /** Server-side errors from the last save, keyed by measurement key. */
  errors?: Record<string, string>;
}>();

const emit = defineEmits<{
  save: [changes: Array<{ key: string; value: number | null }>];
}>();

/**
 * Draft state is what the inputs bind to, in display units and as strings — Vue
 * number-casts v-model on <input type="number">, so these hold `string | number`
 * either way (see lib/form-fields.ts).
 */
const draft = ref<Record<string, string | number>>({});
/** Keys the fitter has actually edited, so a prefilled value stops reading as inherited. */
const touched = ref<Set<string>>(new Set());
/**
 * Keys edited since the last save. Separate from `touched`, which is cumulative for
 * the badge: without this every flush re-sent the whole screen, so filling twelve
 * fields sent twelve requests, the last carrying all twelve keys.
 */
const dirty = ref<Set<string>>(new Set());
const localErrors = ref<Record<string, string>>({});

/** Rebuilds the draft when the server sends new values (load, or a save response). */
watch(
  () => [props.definitions, props.values] as const,
  ([definitions, values]) => {
    const next: Record<string, string | number> = {};
    for (const definition of definitions) {
      const held = values[definition.key];
      const local = draft.value[definition.key];
      // Never clobber what the fitter is mid-way through typing.
      next[definition.key] = touched.value.has(definition.key)
        ? (local ?? '')
        : held
          ? toDisplayValue(held.value, definition.unit)
          : '';
    }
    draft.value = next;
  },
  // Not deep: both props are computed, so their identity already changes exactly when
  // the server data behind them does. Deep-watching them re-ran this on every render
  // and churned the DOM while the fitter was interacting with it.
  { immediate: true },
);

let debounce: ReturnType<typeof setTimeout> | undefined;

function onInput(definition: MeasurementDefinition, raw: string | number): void {
  draft.value[definition.key] = raw;
  touched.value.add(definition.key);
  dirty.value.add(definition.key);

  const { min, max } = displayBounds(definition.unit, definition.minValue, definition.maxValue);
  const parsed = raw === '' ? null : Number(raw);

  if (parsed !== null && (!Number.isFinite(parsed) || parsed < min || parsed > max)) {
    localErrors.value[definition.key] =
      `Must be between ${min} and ${max} ${unitLabel(definition.unit)}`;
    return;
  }
  delete localErrors.value[definition.key];

  // Autosave. Debounced because a fitter tabs through a screenful of fields and one
  // request per keystroke would be both wasteful and racy.
  clearTimeout(debounce);
  debounce = setTimeout(() => flush(), 600);
}

function flush(): void {
  const changes = [...dirty.value]
    .filter((key) => !localErrors.value[key])
    .map((key) => {
      const definition = props.definitions.find((d) => d.key === key);
      if (!definition) return null;
      return { key, value: parseEntry(draft.value[key] ?? '', definition.unit) };
    })
    .filter((change): change is { key: string; value: number | null } => change !== null);

  if (changes.length === 0) return;

  // Cleared optimistically. If the save fails the parent calls markDirty() to put
  // these back, so a failed autosave retries on the next edit or step change rather
  // than being dropped.
  for (const change of changes) dirty.value.delete(change.key);
  emit('save', changes);
}

/** Flushes any pending edit — the wizard calls this before moving between steps. */
function flushNow(): void {
  clearTimeout(debounce);
  flush();
}

/** Re-queues keys whose save failed. */
function markDirty(keys: string[]): void {
  for (const key of keys) dirty.value.add(key);
}

defineExpose({ flushNow, markDirty });

const errorFor = (key: string): string | undefined =>
  localErrors.value[key] ?? props.errors?.[key];

const isInherited = (key: string): boolean =>
  Boolean(props.values[key]?.prefilled) && !touched.value.has(key);

const sorted = computed(() => [...props.definitions].sort((a, b) => a.sortOrder - b.sortOrder));
</script>

<template>
  <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
    <div v-for="definition in sorted" :key="definition.key" class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <Label :for="`m-${definition.key}`">{{ definition.label }}</Label>
        <span
          v-if="isInherited(definition.key)"
          class="text-[10px] uppercase tracking-wide text-muted-foreground"
          :data-testid="`inherited-${definition.key}`"
        >
          from last fit
        </span>
      </div>

      <div class="relative">
        <Input
          :id="`m-${definition.key}`"
          type="number"
          :step="unitStep(definition.unit)"
          :model-value="draft[definition.key] ?? ''"
          :invalid="Boolean(errorFor(definition.key))"
          :class="isInherited(definition.key) ? 'pr-10 text-muted-foreground' : 'pr-10'"
          :data-testid="`m-${definition.key}`"
          @update:model-value="onInput(definition, $event as string | number)"
          @blur="flushNow"
        />
        <span
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
        >
          {{ unitLabel(definition.unit) }}
        </span>
      </div>

      <p v-if="definition.helpText && !errorFor(definition.key)" class="text-xs text-muted-foreground">
        {{ definition.helpText }}
      </p>
      <FieldError :message="errorFor(definition.key)" />
    </div>
  </div>
</template>
