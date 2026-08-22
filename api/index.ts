import app from '../server.js';
import { isMusicScaleRequestOriginAllowed } from '../services/server/corsOriginPolicy.js';

export default function handler(req: any, res: any) {
  const allowed = isMusicScaleRequestOriginAllowed({
    origin: req.headers?.origin,
    host: req.headers?.host,
    forwardedHost: req.headers?.['x-forwarded-host'],
  });

  res.setHeader('Vary', 'Origin');

  if (!allowed) {
    return res.status(403).json({ error: 'CORS_ORIGIN_FORBIDDEN' });
  }

  return app(req, res);
}
