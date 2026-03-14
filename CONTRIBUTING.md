# Contributing to Ghost Pitch Engine

3 roles, 4 files, no build tools.

## File Structure

```
index.html          ← Config, state, DOM, TTS, crowd detection, event wiring
js/llm.js           ← LLM framework (shared — don't break it)
js/ghosts.js        ← Ghost generation (Dev 2's zone)
js/show.js          ← Show runner, judging, Boo MC, OVERDRIVE (James's zone)
CLAUDE.md           ← Agent instructions (read this if using Claude Code)
HANDOFF.md          ← Architecture + work split + secrets
CONTRIBUTING.md     ← This file
```

## Roles

### Dev 2: Ghost Generation & Pitch Presentation

**Your file:** `js/ghosts.js`

**What to do:**
1. Edit `GHOST_PROMPT` to make ghost generation prompts more creative
2. Add MORE models to `CONFIG.featherless.models.corpus` in `index.html` — `llmFanOut` hits all of them in parallel (12,000+ available at featherless.ai/models)
3. Make the pitch card visually pop when a ghost presents (edit CSS in `index.html`)
4. After generation, index pitches into Needle (see HANDOFF.md)
5. Keep `FAILSAFE_GHOST` ("Der Speisekarten-Geist") as the last ghost

**Don't touch:**
- `js/show.js` — judging, Boo, crowd, OVERDRIVE
- `js/llm.js` — LLM framework (use it, don't change it without asking)

**Test your changes:**
```bash
git push origin main
open https://hackathon-berlin-mar-2026.westover.lol
```

### Business: Ghost Judge Backstories

You edit `CONFIG.judges` in `index.html` — the backstory strings.

**Each judge has:**
```javascript
{
  key: 'carla',                    // don't change
  name: 'Karla von Strategos',    // ghost name (can edit)
  voiceIdx: 2,                    // don't change
  backstory: 'You are the ghost of Carla Schneider. In life...',  // EDIT THIS
}
```

**Guidelines for backstories:**
- Start with "You are the ghost of [Real Name]."
- Include how they died (funny/dramatic)
- Include what they judge (business viability, technical depth, product craft)
- Include a catchphrase
- Keep under 200 words — these go into LLM prompts

**Also edit:**
- `BOO.backstory` in `js/show.js` — the MC ghost's personality
- Ghost names in `CONFIG.judges[].name` — make them spooky/funny

### James: Judging + Crowd + OVERDRIVE

**My file:** `js/show.js`

**My zone:**
- `judgeGhost()` — judge deliberation with Boo + core + chaos judges
- `booJudge()`, `booSpeak()`, `summonChaosJudges()`
- `decideBuild()` — BUILD/NO BUILD via Boo
- `overdrive()` — build + deploy pipeline
- `runShow()` — main flow orchestration
- Needle integration for judge RAG context

**Also own in `index.html`:**
- `listenToCrowd()` — Web Audio FFT crowd detection
- Crowd detection config (`CONFIG.crowd`)

## Config Block (in `index.html`)

| Key | What | Who edits |
|-----|------|-----------|
| `featherless.apiKey` | API key (expires 2026-03-17) | nobody |
| `featherless.models.corpus` | Models for ghost generation | Dev 2 |
| `featherless.models.judges` | Models for judge LLM calls | James |
| `needle.apiKey` | Needle RAG API key | nobody |
| `crowd.*` | FFT detection params | James |
| `tts.*` | Speech rate/pitch defaults | anyone |
| `judges[]` | Judge personas + backstories | Business |

## Rules

1. **Don't break the flow** — the show runs top to bottom in `runShow()`
2. **Keep it fast** — 2.5 minutes total for the presentation
3. **TTS rate >= 1.1** — ghosts talk fast
4. **Judge verdicts = 1 sentence** — `maxTokens: 60`
5. **Test at the live URL** — local `file://` won't work (needs HTTPS for mic)
6. **Use the LLM framework** — never call `fetch()` to Featherless directly, use `llmCall`/`llmJSON`/`llmFanOut`/`llmStream`
