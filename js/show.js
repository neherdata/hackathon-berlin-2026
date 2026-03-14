// ============================================================
// SHOW RUNNER — James's zone
// STRATEGY: pitch gen + build kick off at START. TTS masks build time.
//           Feedback banner opens on dud rejection. Timestamp-gated.
//           Dud idea is precomputed (hardcoded), only buildable is live-gen.
// ============================================================

// --- TIMING ---
const TIMING = { charsPerSec: 15, showMaxSec: 150 };
function estimateTTS(text) { return Math.ceil(text.length / TIMING.charsPerSec); }
function trimToTime(text, maxSec) {
  const mc = maxSec * TIMING.charsPerSec;
  if (text.length <= mc) return text;
  const t = text.slice(0, mc);
  const cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
  return cut > mc * 0.5 ? t.slice(0, cut + 1) : t + '...';
}
function showTimeLeft() {
  if (!state.startTime) return TIMING.showMaxSec;
  return Math.max(0, TIMING.showMaxSec - (Date.now() - state.startTime) / 1000);
}

// --- PRECOMPUTED DUD — no LLM call needed ---
const PRECOMPUTED_DUDS = [
  { name: 'Der Blockchain-Geist', type: 'The Ghost of Web3', pitch: 'An AI that turns your dreams into NFTs while you sleep. Proof of REM.', tagline: 'Sleep-to-earn, literally.' },
  { name: 'Das Deployment-Gespenst', type: 'The Ghost of DevOps', pitch: 'A CI/CD pipeline that deploys your code to a parallel dimension. Zero downtime because it is in another reality.', tagline: 'Ship it to the void.' },
  { name: 'Der Jira-Geist', type: 'The Ghost of Agile', pitch: 'An AI scrum master that generates infinite subtasks from your tasks until the sprint collapses.', tagline: 'Velocity is just a number.' },
  { name: 'Der GDPR-Geist', type: 'The Ghost of Compliance', pitch: 'A cookie consent popup that uses facial recognition to detect how annoyed you are and makes the buttons smaller.', tagline: 'Accept or else.' },
  { name: 'Das Pitch-Deck-Gespenst', type: 'The Ghost of Series A', pitch: 'An AI that writes pitch decks for other AIs. The VCs are also AIs. Nobody is real. The TAM is infinite.', tagline: 'Fundraising for ghosts, by ghosts.' },
  { name: 'Der Berghain-Bot', type: 'The Ghost of Nightlife', pitch: 'A machine learning model that predicts whether you will get into Berghain. Accuracy: 0%. But the UX is immaculate.', tagline: 'Rejected, but make it beautiful.' },
];
function pickDud() {
  return PRECOMPUTED_DUDS[Math.floor(Math.random() * PRECOMPUTED_DUDS.length)];
}

// --- BOO ---
const BOO = {
  name: 'Boo', voiceIdx: 0, pitch: 0.6, rate: 1.1,
  backstory: 'You are Boo, the Ghost Host — theatrical, dramatic, unhinged.',
};
async function booSpeak(text) {
  await speak(trimToTime(text, 4), { voiceIndex: BOO.voiceIdx, rate: BOO.rate, pitch: BOO.pitch, elVoice: CONFIG.elevenlabs.voices.boo });
}
async function shortSpeak(text, maxSec, opts = {}) {
  await speak(trimToTime(text, maxSec), opts);
}

// --- BUILD ENGINE ---
async function buildProject(ghost) {
  log('BUILD: Generating project code...');
  const buildHint = ghost.buildHint || ghost.pitch;
  const result = await llmCall(llmPick('reason'), [
    { role: 'system', content: 'Generate a COMPLETE single-page web app as one HTML file. CDN deps OK (Leaflet, Chart.js, D3). Real data, dark theme, interactive. Return ONLY HTML, no markdown.' },
    { role: 'user', content: `Build: ${ghost.name} — ${ghost.pitch}\nHint: ${buildHint}\nBerlin-themed. Dark theme (#0a0a0f). Interactive. Single HTML file.` },
  ], { temperature: 0.7, maxTokens: 3072 });
  return result.content;
}

function showDemo(html) {
  const iframe = document.getElementById('demo-frame');
  iframe.classList.remove('hidden');
  iframe.srcdoc = html;
  dom.ghostCard.classList.add('hidden');
  log('BUILD: Demo loaded');
}

// --- REBUILD with feedback ---
async function rebuildWithFeedback(ghost, originalCode, judgeFeedback, superchatFeedback) {
  log('REBUILD: Incorporating feedback...');
  const feedbackContext = `Judge feedback:\n${judgeFeedback}\n\nAudience feedback:\n${superchatFeedback}`;
  const pickResult = await llmJSON(llmPick('fast'), [
    { role: 'system', content: 'Pick 2-3 most impactful suggestions. Return JSON: {"incorporated": [{"from": "name", "suggestion": "what"}]}' },
    { role: 'user', content: feedbackContext },
  ], { temperature: 0.5, maxTokens: 150 });
  const incorporated = pickResult.parsed?.incorporated || [];
  showIncorporated(incorporated);
  const selectedFeedback = incorporated.map(i => `${i.from}: ${i.suggestion}`).join('\n');
  const result = await llmCall(llmPick('reason'), [
    { role: 'system', content: 'Update this web app with the feedback. Return ONLY complete updated HTML, no markdown.' },
    { role: 'user', content: `App: ${ghost.name}\nFeedback:\n${selectedFeedback}\n\nCode:\n${originalCode}` },
  ], { temperature: 0.7, maxTokens: 3072 });
  return { code: result.content, incorporated };
}

function showIncorporated(items) {
  const el = document.getElementById('superchat-stats');
  if (!el || !items.length) return;
  el.innerHTML += `<div style="margin-top:12px;text-align:left">
    <h3 style="color:var(--accent)">INCORPORATING</h3>
    ${items.map(i => `<div style="background:#1a1a2e;border-radius:6px;padding:8px;margin:6px 0;border-left:3px solid var(--accent)">
      <div style="color:var(--ghost);font-size:10px;text-transform:uppercase">${i.from}</div>
      <div style="color:var(--text);margin-top:2px;font-size:12px">${i.suggestion}</div>
    </div>`).join('')}</div>`;
}

// --- USERMAP ---
async function pushToUserMap(text, name = 'audience') {
  if (!CONFIG.usermap?.enabled) return;
  try {
    await fetch(`${CONFIG.usermap.baseUrl}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.usermap.apiKey}` },
      body: JSON.stringify({ text, source: name, tags: ['ghost-pitch', 'live-demo'] }),
    });
  } catch (e) { log(`UserMap: ${e.message}`); }
}

// --- SUPERCHAT (timestamp-gated) ---
async function fetchSuperchat(sinceTs) {
  try {
    const res = await fetch(`/api/feedback?since=${sinceTs}`);
    const data = await res.json();
    const messages = data.recent || [];
    for (const msg of messages.slice(-5)) pushToUserMap(msg.text, msg.name);
    return messages;
  } catch { return []; }
}
function formatSuperchat(messages) {
  if (!messages.length) return 'No audience feedback yet.';
  return messages.map(m => `${m.name}: "${m.text}"`).join('\n');
}

// --- FEEDBACK BANNER ---
function showFeedbackBanner(ghost) {
  const superchatUrl = `${window.location.origin}/superchat.html`;
  const banner = document.getElementById('feedback-banner');
  const urlEl = document.getElementById('feedback-url');
  const textEl = banner.querySelector('.fb-text');
  textEl.innerHTML = `FEEDBACK OPEN — ${ghost.name}<small>${ghost.pitch}</small>`;
  urlEl.textContent = superchatUrl.replace(/^https?:\/\//, '');
  banner.classList.add('visible');

  // Also show QR
  dom.qrContainer.style.display = 'block';
  dom.deployUrl.textContent = superchatUrl;
  if (!dom.qrContainer.querySelector('img')) {
    const qrImg = document.createElement('img');
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(superchatUrl)}&bgcolor=0a0a0f&color=8b5cf6`;
    dom.qrContainer.appendChild(qrImg);
  }
}

// --- JUDGE FEEDBACK ---
async function showJudgeFeedback(precomputedVerdicts) {
  dom.judgePanel.innerHTML = '';
  dom.judgePanel.classList.remove('hidden');
  const feedbacks = [];
  for (let i = 0; i < CONFIG.judges.length; i++) {
    const judge = CONFIG.judges[i];
    const verdict = precomputedVerdicts[i] || 'No comment.';
    const card = document.createElement('div');
    card.className = 'judge-card';
    card.innerHTML = `<h3>${judge.name}</h3><div class="verdict">${verdict}</div>`;
    dom.judgePanel.appendChild(card);
    feedbacks.push({ judge, content: verdict });
  }
  const { judge, content } = feedbacks[0];
  await shortSpeak(content, 5, { voiceIndex: judge.voiceIdx, rate: 1.3, elVoice: CONFIG.elevenlabs.voices[judge.key] });
  return feedbacks.map(f => `${f.judge.name}: "${f.content}"`).join('\n');
}

async function precomputeJudgeVerdicts(ghost) {
  log('Precomputing judge feedback...');
  const models = Object.values(CONFIG.featherless.models.judges);
  const verdicts = [];
  for (let i = 0; i < CONFIG.judges.length; i++) {
    const judge = CONFIG.judges[i];
    const model = models[i % models.length];
    try {
      const { content } = await llmCall(model, [
        { role: 'system', content: `You are ${judge.name}. ${judge.backstory} ONE sentence. Max 12 words.` },
        { role: 'user', content: `Ghost: "${ghost.name}" — ${ghost.pitch}` },
      ], { temperature: 0.8, maxTokens: 25, quiet: true });
      verdicts.push(content);
    } catch { verdicts.push('The spirits are silent.'); }
  }
  return verdicts;
}

function showSuperchatStats(messages) {
  const el = document.getElementById('superchat-stats');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `<h3 style="color:var(--warn)">SUPERCHAT</h3>
    <div style="color:var(--accent);font-size:20px;margin:4px 0">${messages.length} messages</div>
    <div style="color:var(--dim);font-size:11px;max-height:80px;overflow-y:auto">
      ${messages.slice(-5).map(m => `<div><b>${m.name}</b>: ${m.text}</div>`).join('')}
    </div>`;
}

// --- MAIN SHOW FLOW ---
// Dud is precomputed. Only buildable pitch is live-gen (fastest model).
// Build starts IMMEDIATELY after gen. TTS of dud masks build time.
// Feedback banner opens on roast — audience can submit while build runs.
async function runShow() {
  state.startTime = Date.now();
  const feedbackSince = state.startTime;
  dom.btnStart.style.display = 'none';
  dom.btnSkip.style.display = 'inline-block';
  await initMic();

  // Dud is precomputed — zero LLM time
  const dud = pickDud();

  // === GEN buildable pitch (fastest model) + INTRO TTS (parallel) ===
  setPhase('intro', 'SUMMONING');
  let buildable, buildPromise, judgeVerdictsPromise;
  const buildablePromise = generateBuildable().then(b => {
    buildable = b;
    state.ghosts = [dud, b];
    // Show banner with real idea immediately when ready
    showFeedbackBanner(b);
    // Kick off build + judges immediately
    buildPromise = buildProject(b);
    judgeVerdictsPromise = precomputeJudgeVerdicts(b);
    return b;
  });
  await booSpeak("Welcome mortals. Let the haunting begin.");
  await buildablePromise;

  // === DUD PITCH (TTS masks build time) ===
  setPhase('pitch', 'GHOST PITCH');
  dom.ghostCard.classList.remove('hidden');
  dom.ghostName.textContent = dud.name;
  dom.ghostType.textContent = dud.type;
  dom.ghostPitch.textContent = dud.pitch;
  await shortSpeak(`I am ${dud.name}. ${dud.pitch}`, 6, { voiceIndex: 1, rate: 1.2, elVoice: CONFIG.elevenlabs.voices.ghost });

  // === ROAST ===
  setPhase('roast', 'REJECTED');
  const roastJudge = CONFIG.judges[Math.floor(Math.random() * CONFIG.judges.length)];
  const { content: roast } = await llmCall(
    llmPick('fast'),
    [
      { role: 'system', content: `You are ${roastJudge.name}. Roast this terrible idea. ONE sentence, max 10 words.` },
      { role: 'user', content: `"${dud.name}" — ${dud.pitch}` },
    ],
    { temperature: 0.9, maxTokens: 20 }
  );
  await shortSpeak(roast, 4, { voiceIndex: roastJudge.voiceIdx, rate: 1.3, elVoice: CONFIG.elevenlabs.voices[roastJudge.key] });

  // === WAIT FOR BUILD ===
  setPhase('building', 'BUILDING LIVE');
  let builtCode = await buildPromise;

  // === REVEAL DEMO ===
  setPhase('reveal', 'LIVE DEMO');
  showDemo(builtCode);

  // Let audience see demo + submit feedback
  await new Promise(r => setTimeout(r, 5000));

  // === JUDGES + INCORPORATE ===
  setPhase('judging', 'JUDGES + FEEDBACK');
  const judgeVerdicts = await judgeVerdictsPromise;
  const superchatMessages = await fetchSuperchat(feedbackSince);
  showSuperchatStats(superchatMessages);
  const superchatText = formatSuperchat(superchatMessages);
  const judgeFeedback = await showJudgeFeedback(judgeVerdicts);

  setPhase('rebuilding', 'INCORPORATING');
  for (const v of judgeVerdicts) pushToUserMap(v, 'judge');
  const { code: updatedCode, incorporated } = await rebuildWithFeedback(buildable, builtCode, judgeFeedback, superchatText);
  log(`REBUILD: ${incorporated.length} incorporated`);
  showDemo(updatedCode);

  // === DONE ===
  setPhase('done', 'SHOW COMPLETE');
  log(`Done in ${((Date.now() - state.startTime) / 1000).toFixed(0)}s`);
  await booSpeak("Done. Built live. Ghost redeemed.");
}
