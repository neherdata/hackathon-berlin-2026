// ============================================================
// LLM FRAMEWORK — base primitives for all model calls
// Global concurrency queue + retry on 429/5xx
// Shared by all modules. Depends on: CONFIG, state, log(), updateInstrument()
// ============================================================

// --- GLOBAL CONCURRENCY QUEUE (Featherless limit: 4, we use max 3) ---
const LLM_QUEUE = { active: 0, max: 3, waiting: [] };
function llmAcquire() {
  if (LLM_QUEUE.active < LLM_QUEUE.max) {
    LLM_QUEUE.active++;
    return Promise.resolve();
  }
  return new Promise(resolve => LLM_QUEUE.waiting.push(resolve));
}
function llmRelease() {
  LLM_QUEUE.active--;
  if (LLM_QUEUE.waiting.length > 0) {
    LLM_QUEUE.active++;
    LLM_QUEUE.waiting.shift()();
  }
}

// --- llmCall: queued + auto-retry on 429/5xx ---
async function llmCall(model, messages, { temperature = 0.8, maxTokens = 1024, quiet = false, _retries = 2 } = {}) {
  await llmAcquire();
  try {
    return await _llmFetch(model, messages, { temperature, maxTokens, quiet, _retries });
  } finally {
    llmRelease();
  }
}

async function _llmFetch(model, messages, { temperature, maxTokens, quiet, _retries }) {
  for (let attempt = 0; attempt <= _retries; attempt++) {
    const t0 = Date.now();
    updateInstrument({ model });
    if (!quiet) log(`[${LLM_QUEUE.active}/${LLM_QUEUE.max}] ${model.split('/').pop()}${attempt > 0 ? ` (retry ${attempt})` : ''}...`, { model });

    try {
      const res = await fetch(`${CONFIG.featherless.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.featherless.apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      });

      if (res.status === 429 || res.status >= 500) {
        const err = await res.text();
        log(`${res.status} — retrying in ${(attempt + 1)}s...`, { model });
        if (attempt < _retries) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          continue;
        }
        throw new Error(`Featherless ${res.status}: ${err}`);
      }

      if (!res.ok) {
        const err = await res.text();
        log(`ERROR: ${res.status} — ${err}`, { model });
        throw new Error(`Featherless ${res.status}: ${err}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage?.total_tokens || 0;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      updateInstrument({ model, tokens: usage });
      if (!quiet) log(`Response in ${elapsed}s`, { model, tokens: usage });

      return { content, usage, elapsed, model };
    } catch (e) {
      if (attempt < _retries && (e.message.includes('fetch') || e.message.includes('network'))) {
        log(`Network error, retry ${attempt + 1}...`, { model });
        await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }
      throw e;
    }
  }
}

// --- llmJSON: call + extract + parse JSON, with retry ---
async function llmJSON(model, messages, { temperature = 0.8, maxTokens = 512, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await llmCall(model, messages, { temperature, maxTokens, quiet: attempt > 0 });
      const objMatch = result.content.match(/\{[\s\S]*\}/);
      const arrMatch = result.content.match(/\[[\s\S]*\]/);
      const jsonStr = objMatch ? objMatch[0] : arrMatch ? arrMatch[0] : null;
      if (!jsonStr) throw new Error('No JSON found in response');
      return { ...result, parsed: JSON.parse(jsonStr) };
    } catch (e) {
      if (attempt === retries) {
        log(`JSON parse failed after ${retries + 1} attempts: ${e.message}`, { model });
        return { content: '', usage: 0, elapsed: '0', model, parsed: null };
      }
      log(`Retry ${attempt + 1}/${retries}...`, { model });
    }
  }
}

// --- llmFanOut: hit N models with concurrency limit, collect successes ---
async function llmFanOut(models, messages, { temperature = 0.9, maxTokens = 512, parseJSON = false, concurrency = 3 } = {}) {
  log(`Fan-out across ${models.length} models (max ${concurrency} concurrent)...`);
  const fn = parseJSON ? llmJSON : llmCall;
  const results = [];
  const queue = [...models];

  async function worker() {
    while (queue.length > 0) {
      const model = queue.shift();
      try {
        const result = await fn(model, messages, { temperature, maxTokens, quiet: true });
        results.push(result);
      } catch (e) {
        log(`${model.split('/').pop()} failed: ${e.message}`);
        results.push(null);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, models.length) }, () => worker()));

  const successes = results.filter(r => r && (parseJSON ? r.parsed !== null : r.content));
  log(`Fan-out: ${successes.length}/${models.length} succeeded`);
  return successes;
}

// --- llmPick: choose best model for a task ---
function llmPick(purpose) {
  const m = CONFIG.featherless.models;
  switch (purpose) {
    case 'fast':    return m.corpus[0];                     // Mistral-Nemo (fastest)
    case 'reason':  return m.corpus[1];                     // Mistral-Large (best quality)
    case 'random':  return m.corpus[Math.floor(Math.random() * m.corpus.length)];
    case 'judge':   return Object.values(m.judges)[Math.floor(Math.random() * Object.values(m.judges).length)];
    default:        return m.corpus[0];
  }
}
