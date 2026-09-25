import { logSystemEvent } from './logger';

export type DryRunMetadata = Record<string, string | number | boolean | null | undefined>;

export function dropshippingDryRunEnabled(value = process.env.DROPSHIPPING_DRY_RUN) {
  if (value == null || value.trim() === '') return false;
  if (['true', '1', 'on'].includes(value.trim().toLowerCase())) return true;
  if (['false', '0', 'off'].includes(value.trim().toLowerCase())) return false;
  throw new Error('DROPSHIPPING_DRY_RUN must be ON or OFF');
}

export async function logDryRunAction(
  operation: string,
  metadata: DryRunMetadata,
  logger: typeof logSystemEvent = logSystemEvent,
) {
  await logger('INFO', 'dropshipping_dry_run', `Dry run: ${operation}`, {
    operation,
    ...metadata,
  });
}
