import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Check } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import type { EcosystemOrganizationAvailable } from '../../services/ecosystem/types';

export function AccountOrganizations({ organizations, currentId, onSwitch }: {
  organizations: EcosystemOrganizationAvailable[];
  currentId?: string;
  onSwitch: (id: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const current = organizations.find(org => org.id === currentId);
  const filtered = useMemo(() => organizations.filter(org => org.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [organizations, query]);
  const switchTo = async (id: string) => {
    if (pending || id === currentId) return;
    setPending(id);
    setError(false);
    try {
      if (await onSwitch(id)) setOpen(false);
      else setError(true);
    } catch { setError(true); }
    finally { setPending(null); }
  };
  const row = (org: EcosystemOrganizationAvailable) => (
    <button key={org.id} type="button" disabled={!!pending || org.id === currentId} onClick={() => switchTo(org.id)} aria-current={org.id === currentId ? 'true' : undefined}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default dark:border-white/10">
      <span className="min-w-0"><span className="block truncate font-semibold">{org.name}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{t(`refinement.roles.${org.role}`, { defaultValue: org.role })}{org.id === currentId && ` · ${t('refinement.currentOrganization')}`}</span></span>
      {org.id === currentId ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : pending === org.id ? <span role="status">{t('refinement.switching')}</span> : null}
    </button>
  );
  if (!organizations.length) return null;
  return (
    <Card className="min-w-0">
      <h3 className="mb-3 flex items-center gap-2 font-bold"><Building2 aria-hidden="true" className="h-5 w-5 text-primary" />{t('refinement.currentOrganization')}</h3>
      {current && row(current)}
      <h4 className="mb-3 mt-5 text-sm font-semibold">{t('refinement.yourOrganizations', { count: organizations.length })}</h4>
      <div className="space-y-2" data-testid="account-organizations-preview">{organizations.filter(org => org.id !== currentId).slice(0, 3).map(row)}</div>
      <Button className="mt-3 min-h-11 w-full" variant="secondary" onClick={() => { setError(false); setQuery(''); setOpen(true); }}>{t('refinement.allOrganizations', { count: organizations.length })}</Button>
      {error && !open && <p role="alert" className="mt-3 text-sm text-red-500">{t('refinement.switchError')}</p>}
      <Modal isOpen={open} onClose={() => setOpen(false)} title={t('refinement.yourOrganizations', { count: organizations.length })} maxWidth="max-w-2xl">
        <input type="search" autoFocus className="input-base min-h-11 w-full" value={query} onChange={event => setQuery(event.target.value)} aria-label={t('refinement.searchOrganizations')} placeholder={t('refinement.searchOrganizations')} />
        {error && <p role="alert" className="text-sm text-red-400">{t('refinement.switchError')}</p>}
        <div className="space-y-2">{filtered.map(row)}</div>
        {!filtered.length && <p role="status">{t('refinement.noOrganizations')}</p>}
        <a className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary" href="https://millionsnest.com" target="_blank" rel="noopener noreferrer">{t('refinement.manageOrganizations')}</a>
      </Modal>
    </Card>
  );
}
