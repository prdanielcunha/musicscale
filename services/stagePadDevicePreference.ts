export const STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY =
  'musicscale_stage_pad_device_output:v1';

const ENABLED = 'enabled';
const DISABLED = 'disabled';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

const resolveStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function readStagePadDeviceOutputPreference(
  storage: StorageReader | null = resolveStorage(),
): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY) !== DISABLED;
  } catch {
    return true;
  }
}

export function writeStagePadDeviceOutputPreference(
  enabled: boolean,
  storage: StorageWriter | null = resolveStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY,
      enabled ? ENABLED : DISABLED,
    );
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
