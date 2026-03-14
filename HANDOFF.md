# Ghost Pitch Engine — Work Split

## Architecture
Single HTML file (`index.html`), everything in-browser except OVERDRIVE build phase.

- **Featherless API** (OpenAI-compatible): `https://api.featherless.ai/v1/chat/completions`
- **Web Speech API**: TTS for all ghost voices
- **Web Audio API**: FFT crowd reaction detection (cheers vs boos)
- **Cloudflare Pages**: deployed at `hackathon-berlin-mar-2026.westover.lol`

## Work Split

### Dev 2: Ghost Generation (corpus + pitch voices)
You own `generateGhosts()` and the pitch presentation phase.

**What to build:**
1. Fan out to ALL Featherless models simultaneously (not just 4 — use as many as possible)
2. Each model generates a ghost with: name, type, pitch, tagline
3. Ghost prompts should be creative — the ghosts need personality
4. Present each ghost on screen with its card, then narrate via Web Speech API
5. The failsafe ghost "Der Speisekarten-Geist" (Menu Ghost) is always added last

**Models available (Feather Premium):**
- `deepseek-ai/DeepSeek-V3-0324` — best reasoning
- `MiniMaxAI/MiniMax-M1-80k` — good for agentic/tool-use ideas
- `moonshotai/Kimi-K2-Instruct` — multimodal
- `mistralai/Mistral-Nemo-Instruct-2407` — fast
- Plus 12,000+ more at featherless.ai/models

**Key function:** `generateGhosts()` around line 380
**Config:** `CONFIG.featherless` at top of file

### James: Judging + Crowd Detection + OVERDRIVE
I own the crowd meter, ghost judge panel, and build/deploy pipeline.

**What I'm building:**
- Crowd reaction FFT (2s windows, cheers vs boos vs silence)
- Ghost judge personas (mirrors real judges: BCG consultant, AI professor, engineer)
- BUILD/NO BUILD decision logic
- OVERDRIVE: triggers build via Jira, streams progress, deploys to `{ghost}.westover.lol`

## How to Run Locally
```bash
# Just open index.html in Chrome/Safari (needs HTTPS for mic — use the deployed URL)
open https://hackathon-berlin-mar-2026.westover.lol
```

## How to Deploy
```bash
CLOUDFLARE_ACCOUNT_ID=142ba4b292818854dd51c20fd05643c7 \
CLOUDFLARE_API_TOKEN=<token> \
wrangler pages deploy . --project-name=hackathon-berlin-mar-2026 --branch=main --commit-dirty=true
```

## Secrets
API key is embedded in `index.html` (throwaway hackathon key, expires 2026-03-17).

## Repo
https://github.com/neherdata/hackathon-berlin-2026
