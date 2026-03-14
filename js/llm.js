// ============================================================
// LLM FRAMEWORK — base primitives for all model calls
// Shared by all modules. Depends on: CONFIG, state, log(), updateInstrument()
// ============================================================

// --- llmCall: single model, single response ---
async function llmCall(model, messages, { temperature = 0.8, maxTokens = 1024, quiet = false } = {}) {
  const t0 = Date.now();
  updateInstrument({ model });
  if (!quiet) log(`Calling ${model.split('/').pop()}...`, { model });

  const res = await fetch(`${CONFIG.featherless.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.featherless.apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

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
// Featherless allows 4 concurrent connections — this pools requests
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

  // Launch N workers that pull from the queue
  await Promise.all(Array.from({ length: Math.min(concurrency, models.length) }, () => worker()));

  const successes = results.filter(r => r && (parseJSON ? r.parsed !== null : r.content));
  log(`Fan-out: ${successes.length}/${models.length} succeeded`);
  return successes;
}

// --- llmStream: streaming call for OVERDRIVE build log ---
async function llmStream(model, messages, { temperature = 0.7, maxTokens = 2048, onChunk } = {}) {
  updateInstrument({ model });
  log(`Streaming from ${model.split('/').pop()}...`, { model });

  const res = await fetch(`${CONFIG.featherless.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.featherless.apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Featherless stream ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          if (onChunk) onChunk(delta, full);
        }
      } catch {}
    }
  }

  log(`Stream complete (${full.length} chars)`, { model });
  return { content: full, model };
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
