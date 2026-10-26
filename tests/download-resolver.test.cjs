const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'site.js'), 'utf8');
const originalUrl = 'https://danboxq.lanzouq.com/ieABh4aclf6j';

function resolver(fetch) {
  const context = vm.createContext({
    fetch, AbortController, URL, setTimeout, clearTimeout,
    document: { addEventListener() {} }
  });
  vm.runInContext(source, context);
  return context.resolveLanzouDirectUrl;
}

test('uses the existing resolver endpoint and encodes the complete source URL', async () => {
  const resolve = resolver(async (url, options) => {
    assert.equal(url, 'https://lanzou.opengl.top/index.php?url=' + encodeURIComponent(originalUrl));
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ downUrl: 'https://downloads.example.test/danbo.apk' }) };
  });
  assert.equal(await resolve(originalUrl), 'https://downloads.example.test/danbo.apk');
});

test('rejects an HTTP failure even when its body contains a URL', async () => {
  const resolve = resolver(async () => ({ ok: false, json: async () => ({ downUrl: 'https://example.test/file' }) }));
  await assert.rejects(resolve(originalUrl), /resolver_http_error/);
});

test('rejects empty or malformed resolver responses', async () => {
  for (const result of [null, {}, { downUrl: '' }, { downUrl: 42 }, { downUrl: '/relative/file' }]) {
    const resolve = resolver(async () => ({ ok: true, json: async () => result }));
    await assert.rejects(resolve(originalUrl));
  }
});

test('rejects executable and local-file URL schemes', async () => {
  for (const downUrl of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/download']) {
    const resolve = resolver(async () => ({ ok: true, json: async () => ({ downUrl }) }));
    await assert.rejects(resolve(originalUrl), /invalid_download_url/);
  }
});

test('propagates network and JSON errors so the page can show its fallback', async () => {
  await assert.rejects(resolver(async () => { throw new Error('network_unavailable'); })(originalUrl), /network_unavailable/);
  await assert.rejects(resolver(async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid_json'); } }))(originalUrl), /invalid_json/);
});

test('aborts a stalled request and allows a subsequent retry', async () => {
  let calls = 0;
  const resolve = resolver(async (_url, { signal }) => {
    calls++;
    if (calls === 2) return { ok: true, json: async () => ({ downUrl: 'https://example.test/retry.apk' }) };
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true }));
  });
  await assert.rejects(resolve(originalUrl, 15), error => error.name === 'AbortError');
  assert.equal(await resolve(originalUrl), 'https://example.test/retry.apk');
});

test('allows the PHP fallback chain to finish after the old 12-second cutoff', async () => {
  const timers = [];
  const context = vm.createContext({
    AbortController, URL,
    setTimeout: (callback, ms) => { const timer = { callback, ms }; timers.push(timer); return timer; },
    clearTimeout() {}, document: { addEventListener() {} },
    fetch: async (_url, { signal }) => {
      for (const timer of timers) if (timer.ms <= 16000) timer.callback();
      if (signal.aborted) throw new DOMException('Timed out', 'AbortError');
      return { ok: true, json: async () => ({ code: 200, downUrl: 'https://example.test/app.zip' }) };
    }
  });
  vm.runInContext(source, context);
  assert.equal(await context.resolveLanzouDirectUrl(originalUrl), 'https://example.test/app.zip');
});

test('preserves a server error even when a response includes a stale URL', async () => {
  const resolve = resolver(async () => ({ ok: true, json: async () => ({ code: 400, msg: '解析下载参数失败', downUrl: 'https://example.test/stale.zip' }) }));
  await assert.rejects(resolve(originalUrl), error => error.name === 'ResolverError' && error.message === '解析下载参数失败');
});
