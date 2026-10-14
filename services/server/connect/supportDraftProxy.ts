const CONNECT_ENDPOINT = 'https://connect.millionsnest.com/api/core/support/draft';
/** Relay only identity and requested scope; Connect/Hub remain the authority. No send occurs here. */
export function createConnectSupportDraftProxy(fetchImpl: typeof fetch = fetch) {
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.headers['x-connect-user-authorization'] ?? req.headers.authorization;
    const org = req.headers['x-organization-id'];
    if (typeof token !== 'string' || token.length > 8192 || !/^Bearer\s+\S+$/i.test(token)) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    if (typeof org !== 'string' || !org.trim() || org.length > 180 || /[\\/\u0000-\u001f]/.test(org) || !req.body || Array.isArray(req.body) ||
        Object.keys(req.body).some(key => key !== 'locale') || !['pt-BR', 'en-US', 'es-ES'].includes(req.body.locale)) return res.status(400).json({ code: 'INVALID_SUPPORT_SCOPE' });
    try {
      const response = await fetchImpl(CONNECT_ENDPOINT, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'musicscale', organizationId: org, locale: req.body.locale }) });
      if (!response.ok) return res.status([401, 403, 404, 409].includes(response.status) ? response.status : 503).json({ code: 'SUPPORT_UNAVAILABLE' });
      const data = await response.json();
      const url = new URL(data.draftUrl);
      if (data.product !== 'musicscale' || data.automaticSend !== false || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 630000 ||
          url.origin !== 'https://wa.me' || url.username || url.password || url.hash || !/^\/[1-9][0-9]{7,14}$/.test(url.pathname) ||
          !url.searchParams.get('text') || url.searchParams.get('text')!.length > 2048 || [...url.searchParams.keys()].some(key => key !== 'text') ||
          url.searchParams.get('text')!.includes(token.replace(/^Bearer\s+/i, ''))) throw new Error();
      return res.json({ product: 'musicscale', automaticSend: false, expiresAt: data.expiresAt, draftUrl: url.toString() });
    } catch { return res.status(503).json({ code: 'SUPPORT_UNAVAILABLE' }); }
  };
}
