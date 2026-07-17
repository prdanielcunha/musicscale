import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import assert from 'assert';

async function run() {
  // 1. Create a fake "canonical" target server
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

  // 2. Create the preview proxy server
  const proxyApp = express();
  
  proxyApp.use('/api', createProxyMiddleware({
    target: canonicalOrigin,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 15000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        proxyReq.removeHeader('cookie');
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('host');
        proxyReq.setHeader('X-MusicScale-Client-Environment', 'ai-studio-preview');
      }
    }
  }));

  const proxyServer = proxyApp.listen(0);
  const proxyPort = (proxyServer.address() as any).port;
  const proxyUrl = `http://localhost:${proxyPort}`;

  try {
    // Test GET path and query
    let res = await fetch(`${proxyUrl}/api/test?a=1`);
    assert(res.status === 200, "Should return 200");
    assert(targetRequestLog.path === "/api/test", "GET preserves path");
    assert(targetRequestLog.query.a === "1", "GET preserves query");
    assert(!targetRequestLog.headers.cookie, "Cookie not forwarded");
    assert(!targetRequestLog.headers['x-forwarded-host'], "X-Forwarded-Host not forwarded");
    assert(targetRequestLog.headers['x-musicscale-client-environment'] === 'ai-studio-preview', "Client environment header sent");

    // Test POST body
    res = await fetch(`${proxyUrl}/api/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ABC' },
      body: JSON.stringify({ hello: 'world' })
    });
    assert(res.status === 200);
    assert(targetRequestLog.method === 'POST');
    assert(targetRequestLog.body.hello === 'world', "POST preserves body");
    assert(targetRequestLog.headers.authorization === 'Bearer ABC', "Authorization header preserved");

    // Test PATCH
    res = await fetch(`${proxyUrl}/api/patch`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: '{"patch":true}'});
    assert(targetRequestLog.method === 'PATCH');
    assert(targetRequestLog.body.patch === true, "PATCH preserves body");

    // Test DELETE
    res = await fetch(`${proxyUrl}/api/delete`, { method: 'DELETE' });
    assert(targetRequestLog.method === 'DELETE');

    // Test status codes
    res = await fetch(`${proxyUrl}/api/error401`);
    assert(res.status === 401, "Preserves 401");
    res = await fetch(`${proxyUrl}/api/error403`);
    assert(res.status === 403, "Preserves 403");
    res = await fetch(`${proxyUrl}/api/error500`);
    assert(res.status === 500, "Preserves 500");

    console.log("All proxy functional tests passed!");
  } finally {
    canonicalServer.close();
    proxyServer.close();
  }
}
run();
