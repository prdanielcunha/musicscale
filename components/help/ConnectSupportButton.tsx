import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';

function EnabledConnectSupportButton() {
  const { user, effectiveOrganizationId } = useAuth();
  const { i18n } = useTranslation();
  const epoch = useRef(0);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => { epoch.current++; setBusy(false); setFailed(false); return () => { epoch.current++; }; }, [user?.uid, effectiveOrganizationId]);
  const locale = i18n.language.startsWith('en') ? 'en-US' : i18n.language.startsWith('es') ? 'es-ES' : 'pt-BR';
  const copy = {
    'pt-BR': ['Conversar no WhatsApp oficial', 'Não foi possível abrir o WhatsApp. Use o suporte por e-mail abaixo.'],
    'en-US': ['Chat on official WhatsApp', 'Could not open WhatsApp. Use email support below.'],
    'es-ES': ['Hablar por WhatsApp oficial', 'No se pudo abrir WhatsApp. Usa el soporte por correo abajo.'],
  }[locale];
  const open = async () => {
    if (!user || !effectiveOrganizationId || busy) return;
    const generation = epoch.current;
    const popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null;
    setBusy(true); setFailed(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/connect/support-draft', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Connect-User-Authorization': `Bearer ${token}`, 'x-organization-id': effectiveOrganizationId, 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) });
      if (!response.ok) throw new Error();
      const data = await response.json(), url = new URL(data.draftUrl);
      if (data.automaticSend !== false || data.product !== 'musicscale' || url.origin !== 'https://wa.me' || url.username || url.password || !/^\/[1-9][0-9]{7,14}$/.test(url.pathname)) throw new Error();
      if (generation !== epoch.current) { popup?.close(); return; }
      if (popup) { if (!popup.closed) popup.location.href = url.toString(); } else window.location.assign(url.toString());
    } catch { popup?.close(); if (generation === epoch.current) setFailed(true); }
    finally { if (generation === epoch.current) setBusy(false); }
  };
  return <div className="mb-4"><Button type="button" disabled={busy || !user || !effectiveOrganizationId} onClick={() => void open()} className="w-full">{copy[0]}</Button>{failed && <p role="status" className="mt-2 text-sm text-slate-500">{copy[1]}</p>}</div>;
}

export default function ConnectSupportButton() {
  return import.meta.env.VITE_CONNECT_SUPPORT_ENABLED === 'true' ? <EnabledConnectSupportButton /> : null;
}
