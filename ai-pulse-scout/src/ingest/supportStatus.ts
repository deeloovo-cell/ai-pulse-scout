import type { ProductionSupportStatus } from './types.js';

const ALL_STATUSES: ProductionSupportStatus[] = [
  'production_supported',
  'partial_supported',
  'discoverable_only',
  'deferred',
  'broken',
];

export function summarizeSupportStates(
  results: Array<{ status: ProductionSupportStatus }>,
): Record<ProductionSupportStatus, number> {
  const summary = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<ProductionSupportStatus, number>;

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}
