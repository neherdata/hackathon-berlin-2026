# Ghost Pitch Engine

AI Mini Hackathon Berlin 2026 — fully autonomous ghost startup pitch show.

## Architecture

```
index.html          ← Config, state, DOM, TTS, crowd detection (core plumbing)
js/llm.js           ← LLM framework (llmCall, llmJSON, llmFanOut, llmStream, llmPick)
js/ghosts.js        ← Ghost generation (Dev 2's zone)
js/show.js          ← Show runner, judging, Boo MC, OVERDRIVE (James's zone)
```

**No build tools. No bundler. No npm.** Plain `<script src>` tags. Deploy = push files to Cloudflare Pages.

## File Ownership

| File | Owner | What to edit |
|------|-------|-------------|
| `js/ghosts.js` | Dev 2 | `GHOST_PROMPT`, `generateGhosts()`, `FAILSAFE_GHOST` |
| `js/show.js` | James | Judging, Boo, crowd, OVERDRIVE |
| `js/llm.js` | Shared | LLM primitives — edit carefully, both files depend on it |
| `index.html` CONFIG block | Business / anyone | Judge backstories, model list, API keys, TTS settings |
| `index.html` HTML/CSS | Anyone | UI layout, styles |

## LLM Framework (`js/llm.js`)

All model calls go through these primitives. Never call `fetch()` to Featherless directly.

```javascript
// Single call — returns { content, usage, elapsed, model }
await llmCall(model, messages, { temperature, maxTokens, quiet })

// Call + auto-parse JSON from response — returns { ...llmCall, parsed }
await llmJSON(model, messages, { temperature, maxTokens, retries })

// Parallel fan-out across N models — returns array of successes
await llmFanOut(models, messages, { temperature, maxTokens, parseJSON })

// SSE streaming — calls onChunk(delta, fullText) as tokens arrive
await llmStream(model, messages, { temperature, maxTokens, onChunk })

// Pick a model by purpose: 'fast', 'reason', 'random', 'judge'
llmPick('fast')  // fastest corpus model
llmPick('reason') // best reasoning model
llmPick('random') // random corpus model
```

## Globals Available Everywhere

These are defined in `index.html` and available to all JS files:

- `CONFIG` — all config (Featherless, crowd, TTS, judges, needle, overdrive)
- `state` — app state (phase, ghosts, crowdScores, tokens, audio context)
- `dom` — DOM element refs (ghostCard, judgePanel, transcript, buttons, etc.)
- `log(msg, { model, tokens })` — log to transcript panel
- `setPhase(phase, label)` — update phase indicator
- `updateInstrument({ model, tokens })` — update header instrumentation
- `speak(text, { voiceIndex, rate, pitch })` — TTS via Web Speech API
- `initMic()` / `listenToCrowd()` — crowd FFT detection

## Agent Patterns for Working on This Codebase

### Read Before You Write
Always read the file you're editing first. Understand the globals, the flow, the dependencies.

### Test at the Live URL
Local `file://` won't work — mic needs HTTPS. After changes:
```bash
git push origin main
# Then test at https://hackathon-berlin-mar-2026.westover.lol
```

### Keep It Fast
- **2.5 minutes total** for the entire show presentation
- TTS rate >= 1.1 — ghosts talk fast
- Judge verdicts = 1 sentence max (`maxTokens: 60`)
- Crowd reactions = 2 seconds
- Don't add loading screens or transitions — every second counts

### Respect File Boundaries
- `js/ghosts.js` is Dev 2's zone. Don't refactor it without asking.
- `js/show.js` is James's zone. Don't change judging logic.
- `js/llm.js` is shared — changes here affect everyone. Be careful.

### JSON from LLMs is Unreliable
Always use `llmJSON()` instead of `llmCall()` + manual parsing. It:
- Extracts JSON objects/arrays from markdown-wrapped responses
- Retries on parse failure
- Returns `{ parsed: null }` on total failure instead of throwing

### Fan-Out Pattern
When you need multiple model outputs (ghost generation, brainstorming):
```javascript
const results = await llmFanOut(
  CONFIG.featherless.models.corpus,  // array of model IDs
  messages,
  { parseJSON: true, temperature: 0.9 }
);
// results = array of { content, parsed, model, usage }
```

### Streaming Pattern
For live output (build logs, long generation):
```javascript
await llmStream(llmPick('reason'), messages, {
  onChunk: (delta, full) => {
    dom.buildLog.textContent += delta;
  }
});
```

### Error Handling
- `llmCall` throws on HTTP errors — wrap in try/catch if you need graceful fallback
- `llmJSON` never throws — returns `{ parsed: null }` on failure
- `llmFanOut` catches per-model failures — returns only successes

### Don't Over-Engineer
This is a hackathon. Ship it. If it works in the demo, it's done.
No TypeScript, no tests, no linting, no abstractions. Just working code.

## Featherless API

OpenAI-compatible at `https://api.featherless.ai/v1/chat/completions`.

- 4 concurrent connections max
- 32K context window
- 12,000+ models at featherless.ai/models
- API key expires 2026-03-17

Current models in `CONFIG.featherless.models.corpus`:
- `deepseek-ai/DeepSeek-V3-0324` — best reasoning
- `MiniMaxAI/MiniMax-M1-80k` — good for agentic ideas
- `moonshotai/Kimi-K2-Instruct` — multimodal
- `mistralai/Mistral-Nemo-Instruct-2407` — fastest

Add more models to `corpus` array to get more ghosts from fan-out.

## Deploy

```bash
# Push triggers nothing — manual deploy only
CLOUDFLARE_ACCOUNT_ID=142ba4b292818854dd51c20fd05643c7 \
npx wrangler pages deploy . --project-name=hackathon-berlin-mar-2026 --branch=main --commit-dirty=true
```

## Show Flow

```
Boo MC Intro (8s) → Generate Ghosts (parallel fan-out) →
  for each ghost:
    Ghost Pitch TTS (10s) → Crowd Reaction (2s) →
    if dud: "Banished." → next ghost
    Judging Round 1: Boo + 3 judges (15s) →
    Crowd Reaction (2s) →
    Judging Round 2: Boo + 3 judges + 2 chaos judges (20s) →
    BUILD/NO BUILD decision by Boo →
    if BUILD: OVERDRIVE (stream build spec, trigger deploy)
```
