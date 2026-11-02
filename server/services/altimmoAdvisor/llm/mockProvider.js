'use strict';
// Fournisseur simulé : même interface que DeepSeek, aucun réseau, aucune dépense.
// Mode « script » (réponses et erreurs imposées, pour les tests) ou mode « auto » (fonction de décision).
const { providerError, abortError } = require('./providerErrors');

const sleep = (ms, signal) => new Promise((resolve, reject) => { const t = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true }); });
const estimate = (messages) => Math.ceil(JSON.stringify(messages).length * 0.35);

function createMockProvider({ script = null, decide = null, model = 'deepseek-flash', chunkSize = 12, delayMs = 0 } = {}) {
  let index = 0;
  return {
    name: 'mock', model, simulated: true,
    async chatStream({ messages, tools = [], signal, onContent = () => {} }) {
      if (signal?.aborted) throw abortError();
      const step = script ? script[Math.min(index, script.length - 1)] : await decide({ messages, tools });
      index += 1;
      if (step.delayMs || delayMs) await sleep(step.delayMs ?? delayMs, signal);
      if (step.error) throw providerError(step.error);
      const content = step.content || '';
      for (let i = 0; i < content.length; i += chunkSize) {
        if (signal?.aborted) throw abortError();
        onContent(content.slice(i, i + chunkSize));
        if (delayMs) await sleep(delayMs, signal);
      }
      const toolCalls = (step.toolCalls || []).map((c, i) => ({ id: c.id || `mock_${index}_${i}`, name: c.name, arguments: typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments || {}) }));
      const usage = step.usage || { prompt_tokens: estimate(messages), prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: estimate(messages), completion_tokens: Math.ceil(content.length * 0.35) + toolCalls.length * 20 };
      return { content, toolCalls, finishReason: step.finishReason || (toolCalls.length ? 'tool_calls' : 'stop'), usage };
    },
  };
}

module.exports = { createMockProvider };
