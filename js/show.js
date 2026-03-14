// ============================================================
// SHOW RUNNER — James's zone
// FLOW: dud pitch → 1 judge roast → PARALLEL build real project
//       → reveal demo → superchat → judges + feedback → incorporate → done
// ============================================================

// --- TIMING ---
const TIMING = {
  charsPerSec: 15,
  showMaxSec: 150,
};

function estimateTTS(text) { return Math.ceil(text.length / TIMING.charsPerSec); }

function trimToTime(text, maxSec) {
  const maxChars = maxSec * TIMING.charsPerSec;
  if (text.length <= maxChars) return text;
  const t = text.slice(0, maxChars);
  const cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
  return cut > maxChars * 0.5 ? t.slice(0, cut + 1) : t + '...';
}

function showTimeLeft() {
  if (!state.startTime) return TIMING.showMaxSec;
  return Math.max(0, TIMING.showMaxSec - (Date.now() - state.startTime) / 1000);
}

// --- BOO ---
const BOO = {
  name: 'Boo',
  voiceIdx: 0,
  pitch: 0.6,
  rate: 1.1,
  backstory: 'You are Boo, the Ghost Host — theatrical, dramatic, unhinged. You love chaos and you love watching ghosts fail.',
};

async function booSpeak(text) {
  const trimmed = trimToTime(text, 12);
  await speak(trimmed, { voiceIndex: BOO.voiceIdx, rate: BOO.rate, pitch: BOO.pitch, elVoice: CONFIG.elevenlabs.voices.boo });
}

// --- BUILD ENGINE: generate project code via LLM ---
async function buildProject(ghost) {
  log('BUILD: Generating project code...');
  const buildHint = ghost.buildHint || ghost.pitch;

  const result = await llmCall(llmPick('reason'), [
    { role: 'system', content: `You are a senior frontend engineer. Generate a COMPLETE, working single-page web app as one HTML file. Include HTML, CSS, and JS inline. You CAN use CDN libraries (Leaflet, Chart.js, D3, Three.js, etc.) via script/link tags. Include real, interesting data — not placeholders. Make it visually impressive with a dark theme. Return ONLY the HTML code, no markdown fences, no explanation.` },
    { role: 'user', content: `Build: ${ghost.name} — ${ghost.pitch}\nHint: ${buildHint}\n\nRequirements:\n- Single HTML file with CDN deps allowed\n- Real data (hardcoded is fine — make it interesting)\n- Dark theme, modern UI\n- Interactive — clicks, hovers, animations\n- Must work when opened directly in a browser` },
  ], { temperature: 0.7, maxTokens: 3072 });

  return result.content;
}

// Inject built code into the demo iframe
function showDemo(html) {
  const iframe = document.getElementById('demo-frame');
  iframe.classList.remove('hidden');
  iframe.srcdoc = html;
  dom.ghostCard.classList.add('hidden');
  log('BUILD: Demo loaded into iframe');
}

// --- REBUILD with feedback ---
// Returns { code, incorporated } — incorporated = which suggestions made it in
async function rebuildWithFeedback(ghost, originalCode, judgeFeedback, superchatFeedback) {
  log('REBUILD: Incorporating feedback...');

  const feedbackContext = `Judge feedback:\n${judgeFeedback}\n\nAudience superchat feedback:\n${superchatFeedback}`;

  // First: pick which suggestions to incorporate
  const pickResult = await llmJSON(llmPick('fast'), [
    { role: 'system', content: 'You are a product manager. Given feedback from judges and audience, pick the 2-3 most impactful and buildable suggestions. Return JSON: {"incorporated": [{"from": "name", "suggestion": "what", "reason": "why"}], "skipped": ["reason1"]}' },
    { role: 'user', content: feedbackContext },
  ], { temperature: 0.5, maxTokens: 200 });

  const incorporated = pickResult.parsed?.incorporated || [];

  // Show which suggestions are being incorporated
  showIncorporated(incorporated);

  // Then: rebuild with selected feedback
  const selectedFeedback = incorporated.map(i => `${i.from}: ${i.suggestion}`).join('\n');

  const result = await llmCall(llmPick('reason'), [
    { role: 'system', content: 'You are a senior frontend engineer. Update this web app to incorporate the selected feedback. Return ONLY the complete updated HTML file — no markdown fences, no explanation, just HTML.' },
    { role: 'user', content: `App: ${ghost.name} — ${ghost.pitch}\n\nFeedback to incorporate:\n${selectedFeedback}\n\nCurrent code:\n${originalCode}\n\nReturn the complete updated HTML:` },
  ], { temperature: 0.7, maxTokens: 4096 });

  return { code: result.content, incorporated };
}

// Show which user suggestions are being incorporated
function showIncorporated(items) {
  const statsEl = document.getElementById('superchat-stats');
  if (!statsEl || !items.length) return;
  statsEl.innerHTML += `
    <div style="margin-top: 16px; text-align: left;">
      <h3 style="color: var(--accent);">INCORPORATING</h3>
      ${items.map(i => `
        <div style="background: #1a1a2e; border-radius: 8px; padding: 12px; margin: 8px 0; border-left: 3px solid var(--accent);">
          <div style="color: var(--ghost); font-size: 11px; text-transform: uppercase;">${i.from}</div>
          <div style="color: var(--text); margin-top: 4px;">${i.suggestion}</div>
        </div>
      `).join('')}
    </div>`;
}

// --- USERMAP: push feedback to UserMap + fetch aggregated ---
async function pushToUserMap(text, name = 'audience') {
  if (!CONFIG.usermap?.enabled) return;
  try {
    await fetch(`${CONFIG.usermap.baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.usermap.apiKey}`,
      },
      body: JSON.stringify({ text, source: name, tags: ['ghost-pitch', 'live-demo'] }),
    });
  } catch (e) { log(`UserMap push failed: ${e.message}`); }
}

async function fetchUserMapFeedback() {
  if (!CONFIG.usermap?.enabled) return [];
  try {
    const res = await fetch(`${CONFIG.usermap.baseUrl}/feedback?limit=50`, {
      headers: { 'Authorization': `Bearer ${CONFIG.usermap.apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.feedback || data.data || data.results || [];
  } catch (e) {
    log(`UserMap fetch failed: ${e.message}`);
    return [];
  }
}

// --- SUPERCHAT: fetch audience feedback + sync to UserMap ---
async function fetchSuperchat() {
  try {
    const res = await fetch('/api/feedback');
    const data = await res.json();
    const messages = data.recent || [];
    // Push new messages to UserMap
    for (const msg of messages.slice(-5)) {
      pushToUserMap(msg.text, msg.name); // fire-and-forget
    }
    return messages;
  } catch {
    return [];
  }
}

function formatSuperchat(messages) {
  if (!messages.length) return 'No audience feedback yet.';
  return messages.map(m => `${m.name}: "${m.text}"`).join('\n');
}

// --- JUDGE FEEDBACK (precomputed or live, sequential to respect concurrency) ---
// If precomputed verdicts are passed, just display + speak them (no LLM calls)
async function showJudgeFeedback(precomputedVerdicts) {
  dom.judgePanel.innerHTML = '';
  dom.judgePanel.classList.remove('hidden');

  const judges = CONFIG.judges;
  const feedbacks = [];

  for (let i = 0; i < judges.length; i++) {
    const judge = judges[i];
    const verdict = precomputedVerdicts[i] || 'No comment.';

    const card = document.createElement('div');
    card.className = 'judge-card';
    card.innerHTML = `<h3>${judge.name}</h3><div class="verdict">${verdict}</div>`;
    dom.judgePanel.appendChild(card);
    feedbacks.push({ judge, content: verdict });
  }

  // Speak 1-2 judges sequentially
  const speakCount = showTimeLeft() < 60 ? 1 : Math.min(2, feedbacks.length);
  for (let i = 0; i < speakCount; i++) {
    const { judge, content } = feedbacks[i];
    const trimmed = trimToTime(content, 8);
    await speak(trimmed, { voiceIndex: judge.voiceIdx, rate: 1.2, elVoice: CONFIG.elevenlabs.voices[judge.key] });
  }

  return feedbacks.map(f => `${f.judge.name}: "${f.content}"`).join('\n');
}

// Precompute judge verdicts (called during pitch gen, before show needs them)
async function precomputeJudgeVerdicts(ghost) {
  log('Precomputing judge feedback...');
  const models = Object.values(CONFIG.featherless.models.judges);
  const verdicts = [];

  // Sequential to avoid concurrency issues
  for (let i = 0; i < CONFIG.judges.length; i++) {
    const judge = CONFIG.judges[i];
    const model = models[i % models.length];
    try {
      const { content } = await llmCall(model, [
        { role: 'system', content: `You are ${judge.name}, a ghost judge. ${judge.backstory} Give ONE specific, actionable piece of feedback. ONE sentence, constructive but spicy.` },
        { role: 'user', content: `Ghost project: "${ghost.name}" — ${ghost.pitch}` },
      ], { temperature: 0.8, maxTokens: 60, quiet: true });
      verdicts.push(content);
    } catch {
      verdicts.push('The spirits are silent on this one.');
    }
  }

  return verdicts;
}

// --- SHOW SUPERCHAT STATS ---
function showSuperchatStats(messages) {
  const statsEl = document.getElementById('superchat-stats');
  if (!statsEl) return;
  statsEl.classList.remove('hidden');
  statsEl.innerHTML = `<h3 style="color: var(--warn)">SUPERCHAT</h3>
    <div style="color: var(--accent); font-size: 24px; margin: 8px 0">${messages.length} messages</div>
    <div style="color: var(--dim); font-size: 12px; max-height: 100px; overflow-y: auto">
      ${messages.slice(-5).map(m => `<div><b>${m.name}</b>: ${m.text}</div>`).join('')}
    </div>`;
}

// --- MAIN SHOW FLOW ---
// All LLM calls are sequenced to respect Featherless 4-connection limit
// Judge verdicts are precomputed during generation to overlap with TTS
async function runShow() {
  state.startTime = Date.now();
  dom.btnStart.style.display = 'none';
  dom.btnSkip.style.display = 'inline-block';

  await initMic();

  // === PHASE 1: INTRO (TTS while generating) ===
  setPhase('intro', 'BOO MC');

  // Boo intro plays while ghosts generate (TTS is not an LLM call)
  const introPromise = booSpeak("Welcome, mortals. A ghost will pitch a terrible idea. We roast it. Then we build something real. Live. Right now.");

  // Generate dud + buildable SEQUENTIALLY (respect concurrency)
  await generateGhosts();
  const dud = state.ghosts[0];
  const buildable = state.ghosts[1];

  // Precompute judge verdicts for the buildable pitch (sequential LLM calls)
  // These happen while intro TTS may still be playing
  const judgeVerdictsPromise = precomputeJudgeVerdicts(buildable);

  // Wait for intro to finish
  await introPromise;

  // === PHASE 2: DUD PITCH + ROAST ===
  setPhase('pitch', 'DUD PITCH');
  dom.ghostCard.classList.remove('hidden');
  dom.ghostName.textContent = dud.name;
  dom.ghostType.textContent = dud.type;
  dom.ghostPitch.textContent = dud.pitch;

  // Ghost pitches the dud (TTS — no LLM call)
  await speak(`I am ${dud.name}. ${dud.pitch}`, { voiceIndex: 1, rate: 1.15, elVoice: CONFIG.elevenlabs.voices.ghost });

  // Fast judge roast — 1 LLM call
  setPhase('roast', 'ROASTING');
  const roastJudge = CONFIG.judges[Math.floor(Math.random() * CONFIG.judges.length)];
  const { content: roast } = await llmCall(
    Object.values(CONFIG.featherless.models.judges)[0],
    [
      { role: 'system', content: `You are ${roastJudge.name}. ${roastJudge.backstory} This idea is TERRIBLE. Roast it in ONE savage sentence.` },
      { role: 'user', content: `Ghost pitched: "${dud.name}" — ${dud.pitch}. Destroy it:` },
    ],
    { temperature: 0.9, maxTokens: 40 }
  );
  await speak(roast, { voiceIndex: roastJudge.voiceIdx, rate: 1.2, elVoice: CONFIG.elevenlabs.voices[roastJudge.key] });

  // === PHASE 3: BUILD THE REAL PROJECT ===
  // Now we have full concurrency budget — build uses 1 call
  setPhase('building', 'BUILDING LIVE');
  await booSpeak("But wait. Another ghost has been building something real.");

  // Build the real project (single LLM call — gets full concurrency)
  let builtCode = await buildProject(buildable);

  // === PHASE 4: REVEAL + SUPERCHAT ===
  setPhase('reveal', 'LIVE DEMO');
  dom.ghostName.textContent = buildable.name;
  dom.ghostType.textContent = buildable.type;
  dom.ghostPitch.textContent = buildable.pitch;
  showDemo(builtCode);

  // Show superchat QR
  const superchatUrl = `${window.location.origin}/superchat.html`;
  dom.qrContainer.style.display = 'block';
  dom.deployUrl.textContent = superchatUrl;
  const qrImg = document.createElement('img');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(superchatUrl)}&bgcolor=0a0a0f&color=8b5cf6`;
  qrImg.alt = 'Superchat QR';
  dom.qrContainer.appendChild(qrImg);

  await booSpeak("Scan the code. Tell us what you think. Your feedback shapes the build.");

  // Wait for audience feedback
  await new Promise(r => setTimeout(r, 8000));

  // === PHASE 5: JUDGES SPEAK (precomputed) + INCORPORATE FEEDBACK ===
  setPhase('judging', 'JUDGES + FEEDBACK');

  // Get precomputed verdicts (should be ready by now)
  const judgeVerdicts = await judgeVerdictsPromise;

  // Fetch superchat + push to UserMap
  const superchatMessages = await fetchSuperchat();
  showSuperchatStats(superchatMessages);
  const superchatText = formatSuperchat(superchatMessages);

  // Show judge verdicts + speak them (NO LLM calls — precomputed)
  // While judges speak, start rebuild in background
  const judgeFeedback = await showJudgeFeedback(judgeVerdicts);

  // Rebuild incorporating ALL feedback (1 LLM call for pick + 1 for rebuild = sequential)
  setPhase('rebuilding', 'INCORPORATING');
  log('REBUILD: Judges + superchat → UserMap → updated build');

  // Push judge feedback to UserMap too
  for (const verdict of judgeVerdicts) {
    pushToUserMap(verdict, 'judge'); // fire-and-forget
  }

  const { code: updatedCode, incorporated } = await rebuildWithFeedback(buildable, builtCode, judgeFeedback, superchatText);
  log(`REBUILD: ${incorporated.length} suggestions incorporated`);

  showDemo(updatedCode);

  // === PHASE 6: CLOSE ===
  setPhase('done', 'SHOW COMPLETE');
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  log(`Show complete in ${elapsed}s`);
  await booSpeak("Done. Built live. Feedback incorporated. The ghost is redeemed.");
}
