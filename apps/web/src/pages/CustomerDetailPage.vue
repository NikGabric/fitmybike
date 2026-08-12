<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  BIKE_TYPE_LABELS,
  bikeLabel,
  formatHeight,
  formatWeight,
} from '@fitmybike/shared';
import { ArrowLeft, Bike as BikeIcon, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import { buttonVariants } from '@/components/ui/button-variants';
import { api, unwrap } from '@/lib/api';

const props = defineProps<{ id: string }>();

const router = useRouter();
const queryClient = useQueryClient();

const customer = useQuery({
  queryKey: ['customer', computed(() => props.id)],
  queryFn: () => unwrap(api.GET('/api/customers/{id}', { params: { path: { id: props.id } } })),
});

const bikes = useQuery({
  queryKey: ['bikes', computed(() => props.id)],
  queryFn: () =>
    unwrap(
      api.GET('/api/customers/{customerId}/bikes', {
        params: { path: { customerId: props.id } },
      }),
    ),
});

const fits = useQuery({
  queryKey: ['fits', computed(() => props.id)],
  queryFn: () =>
    unwrap(api.GET('/api/fits', { params: { query: { customerId: props.id, perPage: 50 } } })),
});

const removeBike = useMutation({
  mutationFn: (id: string) => unwrap(api.DELETE('/api/bikes/{id}', { params: { path: { id } } })),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bikes'] }),
});

const startFit = useMutation({
  mutationFn: (bikeId: string) =>
    unwrap(api.POST('/api/fits', { body: { customerId: props.id, bikeId, reason: null } })),
  onSuccess: async (fit) => {
    await queryClient.invalidateQueries({ queryKey: ['fits'] });
    await router.push({ name: 'fit', params: { id: fit.id } });
  },
});

function confirmRemoveBike(id: string, label: string): void {
  if (window.confirm(`Remove ${label}? Past fits on it are kept.`)) removeBike.mutate(id);
}

const fullName = computed(() =>
  customer.data.value ? `${customer.data.value.firstName} ${customer.data.value.lastName}` : '',
);

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const formatDate = (iso: string): string => dateFormat.format(new Date(iso));
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <RouterLink
      :to="{ name: 'customers' }"
      class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      All customers
    </RouterLink>

    <p v-if="customer.isPending.value" class="text-sm text-muted-foreground">Loading…</p>

    <p
      v-else-if="customer.isError.value"
      class="text-sm text-destructive"
      data-testid="customer-error"
    >
      {{ customer.error.value?.message ?? 'Could not load this customer' }}
    </p>

    <template v-else-if="customer.data.value">
      <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold" data-testid="customer-name">{{ fullName }}</h1>
          <p class="text-sm text-muted-foreground">
            {{ customer.data.value.email ?? customer.data.value.phone ?? 'No contact details' }}
          </p>
        </div>
        <RouterLink
          :to="{ name: 'customer-edit', params: { id: props.id } }"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          data-testid="edit-customer"
        >
          <Pencil class="size-3.5" aria-hidden="true" />
          Edit details
        </RouterLink>
      </header>

      <Card class="mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Height</p>
          <p class="mt-0.5 tabular-nums">{{ formatHeight(customer.data.value.heightMm) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Weight</p>
          <p class="mt-0.5 tabular-nums">{{ formatWeight(customer.data.value.weightGrams) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Date of birth</p>
          <p class="mt-0.5 tabular-nums">
            {{ customer.data.value.dateOfBirth ? formatDate(customer.data.value.dateOfBirth) : '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Fits</p>
          <p class="mt-0.5 tabular-nums">{{ fits.data.value?.meta.total ?? '—' }}</p>
        </div>
      </Card>

      <p
        v-if="customer.data.value.notes"
        class="mb-6 whitespace-pre-line rounded-card border border-border bg-muted/40 p-4 text-sm"
      >
        {{ customer.data.value.notes }}
      </p>

      <!-- Bikes -->
      <section class="mb-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bikes</h2>
          <RouterLink
            :to="{ name: 'bike-new', params: { customerId: props.id } }"
            :class="buttonVariants({ variant: 'outline', size: 'sm' })"
            data-testid="add-bike"
          >
            <Plus class="size-3.5" aria-hidden="true" />
            Add bike
          </RouterLink>
        </div>

        <Card class="overflow-hidden">
          <p v-if="bikes.isPending.value" class="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>

          <p
            v-else-if="!bikes.data.value?.data.length"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
            data-testid="bikes-empty"
          >
            No bikes yet. Add one to start a fit.
          </p>

          <ul v-else data-testid="bikes-list">
            <li
              v-for="bike in bikes.data.value.data"
              :key="bike.id"
              class="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <BikeIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ bikeLabel(bike) }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ BIKE_TYPE_LABELS[bike.type] }}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                :disabled="startFit.isPending.value"
                :data-testid="`start-fit-${bike.id}`"
                @click="startFit.mutate(bike.id)"
              >
                Start fit
              </Button>
              <RouterLink
                :to="{ name: 'bike-edit', params: { id: bike.id } }"
                :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
                :aria-label="`Edit ${bikeLabel(bike)}`"
              >
                <Pencil class="size-3.5" aria-hidden="true" />
              </RouterLink>
              <Button
                variant="ghost"
                size="sm"
                :disabled="removeBike.isPending.value"
                :aria-label="`Remove ${bikeLabel(bike)}`"
                @click="confirmRemoveBike(bike.id, bikeLabel(bike))"
              >
                <Trash2 class="size-3.5 text-destructive" aria-hidden="true" />
              </Button>
            </li>
          </ul>
        </Card>
      </section>

      <!-- Fit history -->
      <section>
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fit history
        </h2>

        <Card class="overflow-hidden">
          <p v-if="fits.isPending.value" class="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>

          <p
            v-else-if="!fits.data.value?.data.length"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
            data-testid="fits-empty"
          >
            No fits recorded yet.
          </p>

          <table v-else class="w-full text-sm" data-testid="fits-table">
            <thead
              class="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
            >
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Bike</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Reason</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="fit in fits.data.value.data"
                :key="fit.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-3 tabular-nums">
                  <RouterLink
                    :to="{ name: 'fit', params: { id: fit.id } }"
                    class="font-medium hover:underline"
                  >
                    {{ formatDate(fit.startedAt) }}
                  </RouterLink>
                </td>
                <td class="px-4 py-3">{{ bikeLabel(fit.bike) }}</td>
                <td class="px-4 py-3 text-muted-foreground">{{ fit.reason ?? '—' }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs"
                    :class="
                      fit.status === 'COMPLETED'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    "
                  >
                    {{ fit.status === 'COMPLETED' ? 'Completed' : 'In progress' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>
    </template>
  </div>
</template>
