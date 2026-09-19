const enabled = (value: unknown, fallback = false) =>
  typeof value === 'string' ? value === 'true' : fallback;

export const liveFeatureFlags = {
  sharedMusicScaleReadBridge: true,
  liveNodeTransport: true,
  providerAdapters: true,
  servicePlanWrites: enabled(import.meta.env.VITE_LIVE_CLOUD_WRITES, false),
  remoteControl: enabled(import.meta.env.VITE_LIVE_REMOTE_CONTROL, false)
} as const;
