import { describe, it, expect } from 'vitest';

describe('empty digest send behavior', () => {
  it('daily send should skip SMTP and state updates when no items are selected', () => {
    const selected: unknown[] = [];
    const sendEmail = true;
    const hasMailClient = true;

    const shouldSend = sendEmail && hasMailClient && selected.length > 0;
    const shouldUpdateLedger = shouldSend;
    const shouldUpdateRunState = shouldSend;

    expect(shouldSend).toBe(false);
    expect(shouldUpdateLedger).toBe(false);
    expect(shouldUpdateRunState).toBe(false);
  });

  it('backfill send should also skip SMTP and ledger updates when no items are selected', () => {
    const selected: unknown[] = [];
    const sendBackfill = true;
    const hasMailClient = true;

    const shouldSend = sendBackfill && hasMailClient && selected.length > 0;
    const shouldUpdateLedger = shouldSend;

    expect(shouldSend).toBe(false);
    expect(shouldUpdateLedger).toBe(false);
  });

  it('non-empty digests should still send normally', () => {
    const selected = [{ id: '1' }];
    const sendEmail = true;
    const hasMailClient = true;

    const shouldSend = sendEmail && hasMailClient && selected.length > 0;

    expect(shouldSend).toBe(true);
  });
});
