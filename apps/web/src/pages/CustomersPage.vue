<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { formatHeight, formatWeight } from '@fitmybike/shared';
import { Plus, Search, Trash2 } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Input from '@/components/ui/Input.vue';
import TickRail from '@/components/ui/TickRail.vue';
import { buttonVariants } from '@/components/ui/button-variants';
import { api, unwrap } from '@/lib/api';

const PER_PAGE = 25;

const page = ref(1);
const searchInput = ref('');
const search = ref('');

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (value) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    search.value = value.trim();
    page.value = 1;
  }, 250);
});

const queryClient = useQueryClient();

const { data, isPending, isError, error } = useQuery({
  // page and search are refs: vue-query re-runs the query when either changes.
  queryKey: ['customers', page, search],
  queryFn: () =>
    unwrap(
      api.GET('/api/customers', {
        params: {
          query: {
            page: page.value,
            perPage: PER_PAGE,
            ...(search.value ? { search: search.value } : {}),
          },
        },
      }),
    ),
});

const customers = computed(() => data.value?.data ?? []);
const meta = computed(() => data.value?.meta);

const remove = useMutation({
  mutationFn: (id: string) => unwrap(api.DELETE('/api/customers/{id}', { params: { path: { id } } })),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
});

function confirmRemove(id: string, name: string): void {
  if (window.confirm(`Archive ${name}? Their record stays for audit but leaves the list.`)) {
    remove.mutate(id);
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="type-display text-lg uppercase tracking-[0.06em]">Customers</h1>
        <p class="type-eyebrow mt-1 text-muted-foreground">
          {{ meta ? `${meta.total} in your studio` : 'Loading…' }}
        </p>
      </div>
      <RouterLink :to="{ name: 'customer-new' }" :class="buttonVariants()" data-testid="new-customer">
        <Plus class="size-4" aria-hidden="true" />
        New customer
      </RouterLink>
    </header>

    <TickRail class="mb-6" />

    <div class="relative mb-4 max-w-xs">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        v-model="searchInput"
        class="pl-8"
        placeholder="Search name or email"
        aria-label="Search customers"
        data-testid="customer-search"
      />
    </div>

    <Card class="overflow-hidden">
      <p v-if="isPending" class="type-eyebrow px-4 py-10 text-center text-muted-foreground">
        Loading…
      </p>

      <p
        v-else-if="isError"
        class="type-data px-4 py-10 text-center text-sm text-destructive"
        data-testid="customers-error"
      >
        {{ error?.message ?? 'Could not load customers' }}
      </p>

      <p
        v-else-if="customers.length === 0"
        class="px-4 py-10 text-center text-sm text-muted-foreground"
        data-testid="customers-empty"
      >
        {{ search ? `No customers match “${search}”.` : 'No customers yet.' }}
      </p>

      <table v-else class="w-full text-sm" data-testid="customers-table">
        <thead class="border-b border-border bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" class="type-eyebrow px-4 py-3">Name</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Contact</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Height</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Weight</th>
            <th scope="col" class="type-eyebrow px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="customer in customers"
            :key="customer.id"
            class="border-b border-border last:border-0 hover:bg-muted/40"
          >
            <td class="px-4 py-3">
              <RouterLink
                :to="{ name: 'customer-edit', params: { id: customer.id } }"
                class="font-medium text-accent-ink hover:underline"
              >
                {{ customer.lastName }}, {{ customer.firstName }}
              </RouterLink>
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              {{ customer.email ?? customer.phone ?? '—' }}
            </td>
            <!-- Stored in mm; converted only here, at the display edge. The
                 formatted string stays one text node — splitting the unit out
                 would break the e2e assertion that a row contains "172.5 cm". -->
            <td class="type-data px-4 py-3" data-testid="height-cell">
              {{ formatHeight(customer.heightMm) }}
            </td>
            <td class="type-data px-4 py-3">{{ formatWeight(customer.weightGrams) }}</td>
            <td class="px-4 py-3 text-right">
              <Button
                variant="ghost"
                size="sm"
                :disabled="remove.isPending.value"
                :aria-label="`Archive ${customer.firstName} ${customer.lastName}`"
                @click="confirmRemove(customer.id, `${customer.firstName} ${customer.lastName}`)"
              >
                <Trash2 class="size-4 text-destructive" aria-hidden="true" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <div v-if="meta && meta.totalPages > 1" class="mt-4 flex items-center justify-between text-sm">
      <span class="type-data text-muted-foreground">Page {{ meta.page }} of {{ meta.totalPages }}</span>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="meta.page <= 1" @click="page -= 1">
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="meta.page >= meta.totalPages"
          @click="page += 1"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>
