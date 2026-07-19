import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import assert from 'assert';

async function run() {
  const canonicalApp = express();
  canonicalApp.use(express.json());
  
  let targetRequestLog: any = null;
  
  canonicalApp.all('*all', (req, res) => {
    targetRequestLog = {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body
    };
    if (req.path === '/api/error500') return res.status(500).json({ error: 'Server error' });
    if (req.path === '/api/error401') return res.status(401).json({ error: 'Unauthorized' });
    if (req.path === '/api/error403') return res.status(403).json({ error: 'Forbidden' });
    res.json({ message: 'Success from canonical' });
  });

  const canonicalServer = canonicalApp.listen(0);
  const targetPort = (canonicalServer.address() as any).port;
  const canonicalOrigin = `http://localhost:${targetPort}`;
  const canonicalHost = `localhost:${targetPort}`;

  const proxyApp = express();
  
  const createMusicScaleProxy = (env: string) => {
    if (env === 'production') {
      return (req: any, res: any, next: any) => next();
    }
    
    return createProxyMiddleware({
      pathFilter: '/api',
      target: canonicalOrigin,
      changeOrigin: true,
      ws: true,
      proxyTimeout: 15000,
      on: {
        proxyReq: (proxyReq, req, res) => {
          if (req.headers.host && req.headers.host.includes('millionsnest.com')) {
            return;
          }
          proxyReq.removeHeader('cookie');
          proxyReq.removeHeader('x-forwarded-host');
          proxyReq.removeHeader('x-forwarded-proto');
          
          proxyReq.setHeader('X-MusicScale-Client-Environment', 'ai-studio-preview');
        },
        error: (err, req, res) => {
          if (res && 'status' in res) {
            (res as express.Response).status(502).json({ error: 'Bad Gateway', message: 'Canonical API is currently unavailable.' });
          }
        }
      }
    });
  };

  proxyApp.use(createMusicScaleProxy('development'));
  
  const prodProxyApp = express();
  prodProxyApp.use(createMusicScaleProxy('production'));
  prodProxyApp.use('/api', (req, res) => res.status(404).json({ error: 'Not Found' }));

  const proxyServer = proxyApp.listen(0);
  const proxyPort = (proxyServer.address() as any).port;
  const proxyUrl = `http://localhost:${proxyPort}`;

  const prodProxyServer = prodProxyApp.listen(0);
  const prodProxyPort = (prodProxyServer.address() as any).port;
  const prodProxyUrl = `http://localhost:${prodProxyPort}`;

  try {
    let res = await fetch(`${proxyUrl}/api/test?a=1`, {
      headers: {
        'Cookie': 'session=abc',
        'X-Forwarded-Host': 'fake-host',
        'X-Forwarded-Proto': 'https'
      }
    });
    
    assert(res.status === 200, "Should return 200");
    assert(targetRequestLog.path === "/api/test", `GET preserves path. Was ${targetRequestLog.path}`);
    assert(targetRequestLog.query.a === "1", "GET preserves query");
    assert(!targetRequestLog.headers.cookie, "Cookie not forwarded");
    assert(!targetRequestLog.headers['x-forwarded-host'], "X-Forwarded-Host not forwarded");
    assert(!targetRequestLog.headers['x-forwarded-proto'], "X-Forwarded-Proto not forwarded");
    assert(targetRequestLog.headers['x-musicscale-client-environment'] === 'ai-studio-preview', "Client environment header sent");
    
    assert(targetRequestLog.headers.host === canonicalHost, `Host should be ${canonicalHost} but was ${targetRequestLog.headers.host}`);
    
    res = await fetch(`${proxyUrl}/api/post`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ABC',
        'x-organization-id': 'org-123'
      },
      body: JSON.stringify({ hello: 'world' })
    });
    assert(res.status === 200);
    assert(targetRequestLog.method === 'POST');
    assert(targetRequestLog.body.hello === 'world', "POST preserves body");
    assert(targetRequestLog.headers.authorization === 'Bearer ABC', "Authorization header preserved");
    assert(targetRequestLog.headers['x-organization-id'] === 'org-123', "x-organization-id preserved");

    res = await fetch(`${proxyUrl}/api/error401`);
    assert(res.status === 401, "Preserves 401");
    res = await fetch(`${proxyUrl}/api/error403`);
    assert(res.status === 403, "Preserves 403");
    res = await fetch(`${proxyUrl}/api/error500`);
    assert(res.status === 500, "Preserves 500");

    res = await fetch(`${prodProxyUrl}/api/test`);
    assert(res.status === 404, "Proxy should not be active in production (returns 404 from next middleware)");
    
    canonicalServer.close(); 
    res = await fetch(`${proxyUrl}/api/test`);
    assert(res.status === 502, "Should return 502 when target is down");
    const json = await res.json();
    assert(json.error === 'Bad Gateway', "Should return sanitized 502 JSON");

    console.log("All proxy functional tests passed!");
  } finally {
    try { canonicalServer.close(); } catch(e){}
    proxyServer.close();
    prodProxyServer.close();
  }
}

run();
