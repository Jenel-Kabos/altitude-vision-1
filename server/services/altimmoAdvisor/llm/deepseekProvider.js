'use strict';
// Fournisseur DeepSeek (API Chat Completions, format OpenAI) : streaming SSE, appels d'outils,
// réflexion désactivée, usage réel en fin de flux. La clé ne sort jamais de l'en-tête Authorization.
const { providerError, errorForStatus, abortError } = require('./providerErrors');

function createDeepSeekProvider({ config, fetchImpl = fetch }) {
  return {
    name: 'deepseek', model: config.model, simulated: false,
    async chatStream({ messages, tools = [], toolChoice = 'auto', signal, onContent = () => {}, userId, maxTokens = config.maxOutputTokens }) {
      if (!config.enabled) throw providerError('disabled');
      if (!config.keyConfigured) throw providerError('key_missing');
      const timeout = AbortSignal.timeout(config.timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const body = { model: config.model, messages, stream: true, stream_options: { include_usage: true }, thinking: { type: 'disabled' }, max_tokens: maxTokens, temperature: 0.4 };
      if (tools.length) { body.tools = tools; body.tool_choice = toolChoice; }
      if (userId) body.user_id = userId;
      let response;
      try {
        response = await fetchImpl(`${config.baseUrl}/chat/completions`, { method: 'POST', signal: combined, headers: { 'content-type': 'application/json', accept: 'text/event-stream', authorization: `Bearer ${config.apiKey()}` }, body: JSON.stringify(body) });
      } catch {
        if (signal?.aborted) throw abortError();
        if (timeout.aborted) throw providerError('timeout');
        throw providerError('network');
      }
      if (!response.ok) { await response.body?.cancel().catch(() => {}); throw errorForStatus(response.status); }
      let content = ''; let finishReason = null; let usage = null; let done = false; const calls = [];
      const handle = (line) => {
        if (!line.startsWith('data:')) return; // commentaires « : keep-alive » et lignes vides ignorés
        const data = line.slice(5).trim();
        if (data === '[DONE]') { done = true; return; }
        let item; try { item = JSON.parse(data); } catch { throw providerError('malformed'); }
        if (item.usage) usage = item.usage;
        const choice = item.choices?.[0]; if (!choice) return;
        const delta = choice.delta || {};
        if (typeof delta.content === 'string' && delta.content) { content += delta.content; onContent(delta.content); }
        for (const call of delta.tool_calls || []) {
          const slot = calls[call.index] = calls[call.index] || { id: null, name: '', arguments: '' };
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name += call.function.name;
          if (call.function?.arguments) slot.arguments += call.function.arguments;
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      };
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      try {
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n'); pending = lines.pop();
          for (const line of lines) handle(line.trim());
        }
        handle(pending.trim());
      } catch (error) {
        await reader.cancel().catch(() => {});
        if (signal?.aborted) throw abortError();
        if (timeout.aborted) throw providerError('timeout');
        if (error.code) throw error;
        throw providerError('network');
      }
      if (finishReason === 'content_filter') throw providerError('content_filtered');
      if (finishReason === 'insufficient_system_resource') throw providerError('provider_overloaded');
      if (!done || !finishReason) throw providerError('incomplete');
      return { content, toolCalls: calls.filter(Boolean).map((c, i) => ({ id: c.id || `call_${i}`, name: c.name, arguments: c.arguments })), finishReason, usage };
    },
  };
}

module.exports = { createDeepSeekProvider };
