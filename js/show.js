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
    { role: 'system', content: `You are a senior frontend engineer. Generate a COMPLETE, working single-page web app as one HTML file. Include ALL HTML, CSS, and JS inline. The app must work when opened directly in a browser. Use modern CSS (flexbox/grid), vanilla JS, no external dependencies except CDN libraries like Leaflet if needed for maps. Make it visually polished with a dark theme. Return ONLY the HTML code, nothing else — no markdown fences, no explanation.` },
    { role: 'user', content: `Build this app: ${ghost.name} — ${ghost.pitch}\n\nTechnical hint: ${buildHint}\n\nRequirements:\n- Single HTML file, fully self-contained\n- Dark theme (#0a0a0f background)\n- Mobile-friendly\n- Interactive and visually impressive\n- Must work immediately when opened` },
  ], { temperature: 0.7, maxTokens: 4096 });

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

// --- SUPERCHAT: fetch audience feedback ---
async function fetchSuperchat() {
  try {
    const res = await fetch('/api/feedback');
    const data = await res.json();
    return data.recent || [];
  } catch {
    return [];
  }
}

function formatSuperchat(messages) {
  if (!messages.length) return 'No audience feedback yet.';
  return messages.map(m => `${m.name}: "${m.text}"`).join('\n');
}

// --- JUDGE FEEDBACK ---
async function getJudgeFeedback(ghost) {
  const models = Object.values(CONFIG.featherless.models.judges);
  const judges = CONFIG.judges.map((j, i) => ({
    ...j,
    model: models[i % models.length],
  }));

  dom.judgePanel.innerHTML = '';
  dom.judgePanel.classList.remove('hidden');

  // Fire all judge calls in parallel
  const feedbackPromises = judges.map(async (judge) => {
    const card = document.createElement('div');
    card.className = 'judge-card';
    card.innerHTML = `<h3>${judge.name}</h3><div class="verdict">Thinking...</div>`;
    dom.judgePanel.appendChild(card);

    const { content } = await llmCall(judge.model, [
      { role: 'system', content: `You are ${judge.name}, a ghost judge. ${judge.backstory} Give ONE specific, actionable piece of feedback on this project. What would make it better? ONE sentence, constructive but spicy.` },
      { role: 'user', content: `Ghost project: "${ghost.name}" — ${ghost.pitch}` },
    ], { temperature: 0.8, maxTokens: 60 });

    card.querySelector('.verdict').textContent = content;
    return { judge, content };
  });

  const feedbacks = await Promise.all(feedbackPromises);

  // Speak 1-2 judges
  const speakCount = showTimeLeft() < 60 ? 1 : Math.min(2, feedbacks.length);
  for (let i = 0; i < speakCount; i++) {
    const { judge, content } = feedbacks[i];
    const trimmed = trimToTime(content, 8);
    await speak(trimmed, { voiceIndex: judge.voiceIdx, rate: 1.2, elVoice: CONFIG.elevenlabs.voices[judge.key] });
  }

  return feedbacks.map(f => `${f.judge.name}: "${f.content}"`).join('\n');
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
async function runShow() {
  state.startTime = Date.now();
  dom.btnStart.style.display = 'none';
  dom.btnSkip.style.display = 'inline-block';

  await initMic();

  // === PHASE 1: INTRO + GENERATE ===
  setPhase('intro', 'BOO MC');
  // Generate ghosts AND intro in parallel
  const [, ghosts] = await Promise.all([
    booSpeak("Welcome, mortals. A ghost will pitch a terrible idea. We'll roast it. Then we build something REAL. Live. Right now."),
    generateGhosts(),
  ]);

  const dud = state.ghosts[0];
  const buildable = state.ghosts[1];

  // === PHASE 2: DUD PITCH + FAST ROAST + PARALLEL BUILD ===
  // Show dud ghost card
  setPhase('pitch', 'DUD PITCH');
  dom.ghostCard.classList.remove('hidden');
  dom.ghostName.textContent = dud.name;
  dom.ghostType.textContent = dud.type;
  dom.ghostPitch.textContent = dud.pitch;

  // Start building the REAL project in background (this is the magic)
  const buildPromise = buildProject(buildable);
  log('BUILD: Started in background while dud is being roasted...');

  // Ghost pitches the dud
  await speak(`I am ${dud.name}. ${dud.pitch}`, { voiceIndex: 1, rate: 1.15, elVoice: CONFIG.elevenlabs.voices.ghost });

  // Fast judge roast on the dud
  setPhase('roast', 'ROASTING THE DUD');
  const roastJudge = CONFIG.judges[Math.floor(Math.random() * CONFIG.judges.length)];
  const { content: roast } = await llmCall(
    Object.values(CONFIG.featherless.models.judges)[0],
    [
      { role: 'system', content: `You are ${roastJudge.name}. ${roastJudge.backstory} This idea is TERRIBLE. Roast it in ONE savage sentence.` },
      { role: 'user', content: `Ghost pitched: "${dud.name}" — ${dud.pitch}. Destroy this idea:` },
    ],
    { temperature: 0.9, maxTokens: 40 }
  );
  log(`ROAST: ${roast}`);
  await speak(roast, { voiceIndex: roastJudge.voiceIdx, rate: 1.2, elVoice: CONFIG.elevenlabs.voices[roastJudge.key] });

  // Wait for build to finish (should be done by now — we had ~20s of TTS cover)
  setPhase('building', 'BUILDING...');
  await booSpeak("But wait. Another ghost has been building something REAL.");
  let builtCode = await buildPromise;

  // === PHASE 3: REVEAL DEMO + OPEN SUPERCHAT ===
  setPhase('reveal', 'REVEALING BUILD');

  // Update ghost card to show buildable pitch
  dom.ghostName.textContent = buildable.name;
  dom.ghostType.textContent = buildable.type;
  dom.ghostPitch.textContent = buildable.pitch;

  // Show the built demo
  showDemo(builtCode);

  // Show superchat QR / link
  const superchatUrl = `${window.location.origin}/superchat.html`;
  log(`Superchat: ${superchatUrl}`);
  await booSpeak("Mortals! Open your phones. Go to the superchat. Tell us what you think.");

  // Show QR code
  dom.qrContainer.style.display = 'block';
  dom.deployUrl.textContent = superchatUrl;
  dom.deployUrl.style.fontSize = '14px';
  const qrImg = document.createElement('img');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(superchatUrl)}&bgcolor=0a0a0f&color=8b5cf6`;
  qrImg.alt = 'Superchat QR';
  dom.qrContainer.appendChild(qrImg);

  // Wait for audience feedback (give them time)
  await new Promise(r => setTimeout(r, 8000));

  // === PHASE 4: JUDGES EVALUATE + INCORPORATE FEEDBACK ===
  setPhase('judging', 'JUDGES + FEEDBACK');

  // Fetch superchat feedback
  const superchatMessages = await fetchSuperchat();
  showSuperchatStats(superchatMessages);
  const superchatText = formatSuperchat(superchatMessages);

  // Start rebuild with feedback in background (before judges even finish speaking)
  // Judges evaluate the REAL project — their LLM calls happen now
  const judgeFeedbackPromise = getJudgeFeedback(buildable);

  // Wait for judge feedback
  const judgeFeedback = await judgeFeedbackPromise;

  // Start rebuild incorporating ALL feedback
  setPhase('rebuilding', 'INCORPORATING FEEDBACK');
  log('REBUILD: Judges + superchat feedback → updated build');
  const rebuildPromise = rebuildWithFeedback(buildable, builtCode, judgeFeedback, superchatText);

  await booSpeak("The feedback is in. The ghost is rebuilding.");

  const { code: updatedCode, incorporated } = await rebuildPromise;
  log(`REBUILD: ${incorporated.length} suggestions incorporated`);

  // Show updated demo
  showDemo(updatedCode);

  // === PHASE 5: CLOSE ===
  setPhase('done', 'SHOW COMPLETE');
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  log(`Show complete in ${elapsed}s`);
  await booSpeak("Done. Built live. Feedback incorporated. The ghost is redeemed.");
}
