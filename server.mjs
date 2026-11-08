// Local server for MTT Bootcamp: serves index.html and forwards AI requests,
// so the browser does not run into cross-origin (CORS) limits.
// Usage: node server.mjs   then open http://127.0.0.1:8787
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const PORT = Number(process.env.PORT) || 8787;
const ROOT = dirname(fileURLToPath(import.meta.url));
// Only these API hosts are forwarded to. Add more with MTT_ALLOW_HOSTS=host1,host2
const ALLOW = new Set([
  'api.deepseek.com', 'dashscope.aliyuncs.com', 'api.moonshot.cn', 'open.bigmodel.cn',
  'api.siliconflow.cn', 'ark.cn-beijing.volces.com', 'api.openai.com', 'localhost', '127.0.0.1',
  ...(process.env.MTT_ALLOW_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean),
]);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req, limit = 1 << 20) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('请求太大'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

async function proxyChat(req, res) {
  let base, key, body;
  try { ({ base, key, body } = JSON.parse(await readBody(req))); } catch { return send(res, 400, { error: { message: '请求格式不对' } }); }
  let url;
  try { url = new URL(String(base).replace(/\/+$/, '') + '/chat/completions'); } catch { return send(res, 400, { error: { message: '接口地址无效' } }); }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!ALLOW.has(url.hostname) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    return send(res, 403, { error: { message: `本地服务不转发到 ${url.host}。如需使用，请用 MTT_ALLOW_HOSTS=${url.hostname} node server.mjs 启动。` } });
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    send(res, r.status, await r.text(), r.headers.get('content-type') || 'application/json');
  } catch (e) {
    send(res, 502, { error: { message: `连接 ${url.host} 失败：${e.message}` } });
  }
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true, mtt: true });
  if (req.method === 'POST' && path === '/api/chat') return proxyChat(req, res);
  if (req.method !== 'GET') return send(res, 405, { error: { message: 'Method not allowed' } });
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  try { send(res, 200, await readFile(join(ROOT, name)), TYPES[extname(name)] || 'application/octet-stream'); }
  catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MTT 训练营已启动：http://127.0.0.1:${PORT}`);
  console.log('在页面的“模拟赛 → AI 设置”里，把请求方式改成“本地服务”。按 Ctrl+C 停止。');
});
