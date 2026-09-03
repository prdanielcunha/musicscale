export function canUseBulkLibraryImport(
  plan: string | null | undefined,
  status: string | null | undefined,
  isGlobalAdmin = false,
): boolean {
  if (isGlobalAdmin) return true;

  return (
    String(plan || '').toLowerCase().trim() === 'pro' &&
    String(status || '').toLowerCase().trim() === 'active'
  );
}
