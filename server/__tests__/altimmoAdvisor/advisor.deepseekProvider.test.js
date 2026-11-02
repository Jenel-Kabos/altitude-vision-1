/** @jest-environment ./__tests__/altimmoAdvisor/realmCloneEnvironment.js */
'use strict';
const assert = require('node:assert/strict');
const { createDeepSeekProvider } = require('../../services/altimmoAdvisor/llm/deepseekProvider');
const { createMockProvider } = require('../../services/altimmoAdvisor/llm/mockProvider');
const { resolveLlmConfig } = require('../../services/altimmoAdvisor/llm/providerConfig');

const FAKE_KEY = 'sk-test-abcdefghijklmnopqrstuvwxyz'; // factice
const config = resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true', DEEPSEEK_API_KEY: FAKE_KEY });
const sse = (objects, { done = true, keepAlive = true } = {}) => [keepAlive ? ': keep-alive\n\n' : '', ...objects.map((o) => `data: ${JSON.stringify(o)}\n\n`), done ? 'data: [DONE]\n\n' : ''].join('');
const chunk = (delta, finish = null, usage = null) => ({ id: 'x', object: 'chat.completion.chunk', model: 'deepseek-flash', choices: [{ index: 0, delta, finish_reason: finish }], usage });
const streamResponse = (text, { status = 200, split = 7 } = {}) => new Response(new ReadableStream({ start(c) { const b = new TextEncoder().encode(text); for (let i = 0; i < b.length; i += split) c.enqueue(b.slice(i, i + split)); c.close(); } }), { status, headers: { 'content-type': 'text/event-stream' } });
const USAGE = { prompt_tokens: 120, completion_tokens: 9, total_tokens: 129, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: 20 };

test('requête : API officielle, réflexion désactivée, streaming avec usage, outils, user_id anonyme, clé en en-tête', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init, body: JSON.parse(init.body) }; return streamResponse(sse([chunk({ role: 'assistant', content: '' }), chunk({ content: 'Bonjour' }), chunk({ content: ' !' }, 'stop', USAGE)])); };
  const provider = createDeepSeekProvider({ config, fetchImpl });
  const deltas = [];
  const out = await provider.chatStream({ messages: [{ role: 'user', content: 'Salut' }], tools: [{ type: 'function', function: { name: 'search_properties', parameters: { type: 'object', properties: {} } } }], userId: 'sess_hash', onContent: (d) => deltas.push(d) });
  assert.equal(seen.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(seen.init.headers.authorization, `Bearer ${FAKE_KEY}`);
  assert.deepEqual(seen.body.thinking, { type: 'disabled' });
  assert.deepEqual(seen.body.stream_options, { include_usage: true });
  assert.equal(seen.body.stream, true);
  assert.equal(seen.body.model, 'deepseek-flash');
  assert.equal(seen.body.user_id, 'sess_hash');
  assert.equal(seen.body.tools[0].function.name, 'search_properties');
  assert.deepEqual(deltas, ['Bonjour', ' !']);
  assert.deepEqual([out.content, out.finishReason, out.usage.prompt_cache_hit_tokens], ['Bonjour !', 'stop', 100]);
});

test('appels d outils fragmentés : identifiant et nom au premier fragment, arguments ensuite', async () => {
  const fetchImpl = async () => streamResponse(sse([
    chunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'update_criteria', arguments: '' } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: '{"operations":[{"op":"set",' } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: '"path":"district","value":"Poto-Poto"}]}' } }] }),
    chunk({ tool_calls: [{ index: 1, id: 'call_2', type: 'function', function: { name: 'search_properties', arguments: '{}' } }] }),
    chunk({}, 'tool_calls', USAGE),
  ]), { split: 5 });
  const out = await createDeepSeekProvider({ config, fetchImpl }).chatStream({ messages: [], tools: [] });
  assert.equal(out.finishReason, 'tool_calls');
  assert.deepEqual(out.toolCalls.map((c) => [c.id, c.name]), [['call_1', 'update_criteria'], ['call_2', 'search_properties']]);
  assert.deepEqual(JSON.parse(out.toolCalls[0].arguments), { operations: [{ op: 'set', path: 'district', value: 'Poto-Poto' }] });
});

test('erreurs documentées : codes typés, message sans détail technique ni clé', async () => {
  const cases = [[401, 'auth_failed'], [402, 'insufficient_balance'], [400, 'invalid_request'], [422, 'invalid_request'], [429, 'provider_rate_limited'], [500, 'provider_error'], [503, 'provider_overloaded']];
  for (const [status, code] of cases) {
    const fetchImpl = async () => new Response(JSON.stringify({ error: { message: `détail interne ${FAKE_KEY}` } }), { status });
    await assert.rejects(createDeepSeekProvider({ config, fetchImpl }).chatStream({ messages: [] }), (error) => { assert.equal(error.code, code); assert.doesNotMatch(`${error.message}${JSON.stringify(error)}`, /sk-test|détail interne/); return true; });
  }
  await assert.rejects(createDeepSeekProvider({ config, fetchImpl: async () => { throw new TypeError('fetch failed ENOTFOUND api.deepseek.com'); } }).chatStream({ messages: [] }), (e) => e.code === 'network');
});

test('flux incomplet, mal formé, coupé par la longueur ou filtré', async () => {
  const run = (text) => createDeepSeekProvider({ config, fetchImpl: async () => streamResponse(text) }).chatStream({ messages: [] });
  await assert.rejects(run(sse([chunk({ content: 'a' })], { done: false })), (e) => e.code === 'incomplete');
  await assert.rejects(run('data: {pas-json}\n\n'), (e) => e.code === 'malformed');
  await assert.rejects(run(sse([chunk({ content: 'a' }, 'content_filter', USAGE)])), (e) => e.code === 'content_filtered');
  await assert.rejects(run(sse([chunk({ content: 'a' }, 'insufficient_system_resource', USAGE)])), (e) => e.code === 'provider_overloaded');
  const cut = await run(sse([chunk({ content: 'Texte coupé' }, 'length', USAGE)]));
  assert.equal(cut.finishReason, 'length');
});

test('délai dépassé et annulation : codes distincts', async () => {
  const slow = async (_u, init) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const timed = resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true', DEEPSEEK_API_KEY: FAKE_KEY, ALTIMMO_LLM_TIMEOUT_MS: '20' });
  await assert.rejects(createDeepSeekProvider({ config: timed, fetchImpl: slow }).chatStream({ messages: [] }), (e) => e.code === 'timeout');
  const controller = new AbortController(); setTimeout(() => controller.abort(), 5);
  await assert.rejects(createDeepSeekProvider({ config, fetchImpl: slow }).chatStream({ messages: [], signal: controller.signal }), (e) => e.name === 'AbortError');
});

test('sans clé ou désactivé : refus local, aucun appel réseau', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return streamResponse(''); };
  await assert.rejects(createDeepSeekProvider({ config: resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', ALTIMMO_LLM_ENABLED: 'true' }), fetchImpl }).chatStream({ messages: [] }), (e) => e.code === 'key_missing');
  await assert.rejects(createDeepSeekProvider({ config: resolveLlmConfig({ ALTIMMO_LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: FAKE_KEY }), fetchImpl }).chatStream({ messages: [] }), (e) => e.code === 'disabled');
  assert.equal(calls, 0);
});

test('fournisseur simulé : même interface, scénarios d erreur scriptés, jamais de réseau', async () => {
  const mock = createMockProvider({ script: [{ content: 'Bonjour !', usage: USAGE }, { error: 'provider_rate_limited' }, { toolCalls: [{ name: 'search_properties', arguments: '{}' }] }, { content: 'coupé', finishReason: 'length' }] });
  const deltas = [];
  const a = await mock.chatStream({ messages: [], onContent: (d) => deltas.push(d) });
  assert.deepEqual([a.content, deltas.join('')], ['Bonjour !', 'Bonjour !']);
  await assert.rejects(mock.chatStream({ messages: [] }), (e) => e.code === 'provider_rate_limited');
  assert.equal((await mock.chatStream({ messages: [] })).toolCalls[0].name, 'search_properties');
  assert.equal((await mock.chatStream({ messages: [] })).finishReason, 'length');
  assert.equal(mock.simulated, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createMockProvider({ script: [{ content: 'x' }] }).chatStream({ messages: [], signal: controller.signal }), (e) => e.name === 'AbortError');
});
