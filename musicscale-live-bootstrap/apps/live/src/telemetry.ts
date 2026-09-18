export function markLiveMetric(name: string): void {
  if (typeof performance === 'undefined') return;
  performance.mark(`musicscale-live:${name}`);
}
