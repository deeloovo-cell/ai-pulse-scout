export function evaluatePublishThreshold(input: {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
}): { publishable: boolean; failedRatio: number } {
  const failedRatio = input.totalItems === 0 ? 1 : input.failedItems / input.totalItems;
  const publishable = input.successfulItems > 0 && failedRatio <= 0.5;
  return { publishable, failedRatio };
}
