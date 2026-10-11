import { auth } from './firebase';
import type { MedleyTemplate, ScaleMedley } from '../types';

type TemplateDraft = {
  name: string;
  arrangement: ScaleMedley;
  schemaVersion?: 2;
  status?: 'ready';
  parentTemplateId?: string;
};
type Repository = {
  medleyTemplates: {
    list: () => Promise<MedleyTemplate[]>;
    create: (draft: any) => Promise<string>;
  };
};
const fallbackAllowed = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '').toLowerCase();
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return code === 'permission-denied' || code === 'unavailable' ||
    message.includes('missing or insufficient permissions') || message.includes('permission denied');
};
async function backend<T>(orgId: string, method: 'GET' | 'POST', draft?: TemplateDraft): Promise<T> {
  if (!orgId || !auth.currentUser) throw new Error('AUTHENTICATION_REQUIRED');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/v1/medley-templates', {
    method,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-Id': orgId,
      ...(draft ? {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      } : {}),
    },
    ...(draft ? { body: JSON.stringify(draft) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'MEDLEY_TEMPLATE_REQUEST_FAILED');
  return data as T;
}

export async function listMedleyTemplates(api: Repository, organizationId: string): Promise<MedleyTemplate[]> {
  try {
    return await api.medleyTemplates.list();
  } catch (error) {
    if (!fallbackAllowed(error)) throw error;
    const data = await backend<{ items: MedleyTemplate[] }>(organizationId, 'GET');
    return data.items;
  }
}

export async function saveMedleyTemplate(
  api: Repository, organizationId: string, draft: TemplateDraft,
): Promise<string> {
  try {
    return await api.medleyTemplates.create(draft);
  } catch (error) {
    if (!fallbackAllowed(error)) throw error;
    const data = await backend<{ id: string }>(organizationId, 'POST', draft);
    return data.id;
  }
}
