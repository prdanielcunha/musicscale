import { offlineDB, type CustomPadAssetRow } from './database';

const MAX_CUSTOM_PAD_BYTES = 32 * 1024 * 1024;
const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
]);

function assetKey(userId: string, organizationId: string) {
  return `${userId}::${organizationId}::custom-pad`;
}

export function validateCustomPadFile(file: File) {
  if (!file || file.size <= 0) throw new Error('PAD_FILE_EMPTY');
  if (file.size > MAX_CUSTOM_PAD_BYTES) throw new Error('PAD_FILE_TOO_LARGE');
  if (file.type && !ACCEPTED_AUDIO_TYPES.has(file.type)) throw new Error('PAD_FILE_UNSUPPORTED');
}

export async function saveCustomPadAsset(params: {
  userId: string;
  organizationId: string;
  file: File;
  baseKey: string;
}) {
  const { userId, organizationId, file, baseKey } = params;
  if (!userId || !organizationId) throw new Error('PAD_SCOPE_REQUIRED');
  validateCustomPadFile(file);

  const row: CustomPadAssetRow = {
    id: assetKey(userId, organizationId),
    userId,
    organizationId,
    name: file.name,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
    baseKey,
    blob: file.slice(0, file.size, file.type || 'audio/mpeg'),
    updatedAt: Date.now(),
  };
  await offlineDB.customPadAssets.put(row);
  return row;
}

export async function readCustomPadAsset(userId: string, organizationId: string) {
  if (!userId || !organizationId) return null;
  const row = await offlineDB.customPadAssets.get(assetKey(userId, organizationId));
  if (!row || row.userId !== userId || row.organizationId !== organizationId) return null;
  return row;
}

export async function clearCustomPadAsset(userId: string, organizationId: string) {
  if (!userId || !organizationId) return;
  await offlineDB.customPadAssets.delete(assetKey(userId, organizationId));
}

export { MAX_CUSTOM_PAD_BYTES };
