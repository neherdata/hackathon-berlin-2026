// ============================================================
// SHOW RUNNER — James's zone
// NEW FLOW: 1 ghost → dud pitch → crowd + judge feedback → pivot → OVERDRIVE
// Depends on: CONFIG, state, dom, log(), setPhase(), speak(),
//             llmCall(), llmJSON(), llmStream(), llmPick(),
//             generateGhosts(), initMic(), listenToCrowd()
// ============================================================

// --- TIMING BUDGET ---
// ElevenLabs at 1.1x speed ≈ 15 chars/sec. Total show: 150s (2.5 min)
const TIMING = {
  charsPerSec: 15,          // ElevenLabs throughput at 1.1x
  showMaxSec: 150,          // 2.5 minute hard cap
  phases: {                 // time budget per phase (seconds)
    intro: 12,              // Boo intro
    generate: 8,            // ghost generation (network)
    pitch: 10,              // ghost pitches
    crowd: 2,               // crowd reaction window
    feedback: 25,           // boo + 2 judges speak
    pivot: 15,              // ghost incorporates feedback
    overdrive: 40,          // build spec stream
  },
};

// Estimate TTS duration in seconds from text
function estimateTTS(text) {
  return Math.ceil(text.length / TIMING.charsPerSec);
}

// Trim text to fit a time budget (seconds), cutting at sentence boundary
function trimToTime(text, maxSec) {
  const maxChars = maxSec * TIMING.charsPerSec;
  if (text.length <= maxChars) return text;
  const trimmed = text.slice(0, maxChars);
  const lastPeriod = trimmed.lastIndexOf('.');
  const lastExcl = trimmed.lastIndexOf('!');
  const lastQ = trimmed.lastIndexOf('?');
  const cutAt = Math.max(lastPeriod, lastExcl, lastQ);
  return cutAt > maxChars * 0.5 ? trimmed.slice(0, cutAt + 1) : trimmed + '...';
}

// How many seconds remain in the show
function showTimeLeft() {
  if (!state.startTime) return TIMING.showMaxSec;
  return Math.max(0, TIMING.showMaxSec - (Date.now() - state.startTime) / 1000);
}

// --- BOO: MC, Audience Judge, Announcer ---
const BOO = {
  name: 'Boo',
  voiceIdx: 0,
  pitch: 0.6,
  rate: 1.1,
  backstory: 'You are Boo, the Ghost Host. You are the MC, the audience\'s voice, and the final announcer. You interpret crowd energy — cheers, boos, silence — and translate it into ghost verdicts. You are theatrical, dramatic, and a little unhinged. You love chaos.',
};

async function booSpeak(text) {
  const trimmed = trimToTime(text, Math.min(TIMING.phases.intro, showTimeLeft()));
  log(`TTS est: ${estimateTTS(trimmed)}s for ${trimmed.length} chars`);
  await speak(trimmed, { voiceIndex: BOO.voiceIdx, rate: BOO.rate, pitch: BOO.pitch, elVoice: CONFIG.elevenlabs.voices.boo });
}

// --- JUDGE FEEDBACK (not verdict — constructive roast) ---
async function getJudgeFeedback(ghost, crowdScore) {
  const models = Object.values(CONFIG.featherless.models.judges);
  const coreJudges = CONFIG.judges.map((j, i) => ({
    ...j,
    model: models[i % models.length],
    style: j.backstory,
  }));

  dom.judgePanel.innerHTML = '';
  dom.judgePanel.classList.remove('hidden');

  // Boo translates crowd reaction
  const crowdText = crowdScore.sentiment === 'cheer' ? 'The living actually liked this dud?!'
    : crowdScore.sentiment === 'boo' ? 'The living have spoken — this idea STINKS.'
    : crowdScore.sentiment === 'dead' ? 'Nothing. Dead silence. Even worse.'
    : 'The crowd is confused. Fix this.';

  const booReaction = await llmCall(llmPick('fast'), [
    { role: 'system', content: `${BOO.backstory} The ghost just pitched a terrible idea. The crowd reacted. Summarize the crowd's feeling in ONE sentence and tell the ghost to listen to the judges for how to fix it.` },
    { role: 'user', content: `Ghost "${ghost.name}" pitched: "${ghost.pitch}". Crowd: ${crowdText} Energy: ${crowdScore.energy}%.` },
  ], { temperature: 0.9, maxTokens: 50 });

  const booCard = document.createElement('div');
  booCard.className = 'judge-card';
  booCard.style.borderColor = 'var(--warn)';
  booCard.innerHTML = `<h3 style="color: var(--warn)">Boo (The Crowd)</h3><div class="verdict">${booReaction.content}</div>`;
  dom.judgePanel.appendChild(booCard);
  setPhase('feedback', 'BOO SPEAKS');
  await booSpeak(booReaction.content);

  const crowdContext = `Boo says: "${booReaction.content}" (crowd energy: ${crowdScore.energy}%, sentiment: ${crowdScore.sentiment})`;

  // Fire all judge LLM calls in parallel, display + speak round-robin (pick 1-2 to read aloud)
  const feedbackPromises = coreJudges.map(async (judge) => {
    const card = document.createElement('div');
    card.className = 'judge-card';
    card.innerHTML = `<h3>${judge.name}</h3><div class="verdict">Thinking...</div>`;
    dom.judgePanel.appendChild(card);

    const { content } = await llmCall(judge.model, [
      { role: 'system', content: `You are ${judge.name}, a ghost judge at a hackathon. ${judge.style} The ghost pitched a DUD idea. Give ONE specific, actionable piece of feedback to make it better. Be constructive but roast-y. ONE sentence.` },
      { role: 'user', content: `Ghost: "${ghost.name}" pitched: "${ghost.pitch}"\n\n${crowdContext}\n\nYour ONE feedback to improve this idea:` },
    ], { temperature: 0.8, maxTokens: 60 });

    card.querySelector('.verdict').textContent = content;
    return { judge, content };
  });

  const feedbacks = await Promise.all(feedbackPromises);

  // Speak 1-2 judges — fewer if running low on time
  const remaining = showTimeLeft();
  const speakCount = remaining < 60 ? 1 : Math.min(2, feedbacks.length);
  log(`Time left: ${remaining.toFixed(0)}s — ${speakCount} judge(s) will speak`);
  for (let i = 0; i < speakCount; i++) {
    const { judge, content } = feedbacks[i];
    const trimmed = trimToTime(content, 8); // max 8s per judge
    setPhase('feedback', `JUDGE: ${judge.name.toUpperCase()}`);
    await speak(trimmed, { voiceIndex: judge.voiceIdx, rate: 1.2, elVoice: CONFIG.elevenlabs.voices[judge.key] });
  }

  return feedbacks.map(f => `${f.judge.name}: "${f.content}"`).join('\n');
}

// --- GHOST PIVOT: incorporate feedback into improved idea ---
async function pivotGhost(ghost, feedbackSummary, crowdScore) {
  setPhase('pivot', 'GHOST IS PIVOTING');
  log('Ghost incorporating feedback...');

  const { content } = await llmCall(llmPick('reason'), [
    { role: 'system', content: `You are ${ghost.name}, ${ghost.type}. You pitched a bad idea and got roasted. PIVOT — take their feedback and pitch something ACTUALLY good. 2 sentences max: acknowledge, then pitch the improved version.` },
    { role: 'user', content: `Your original pitch: "${ghost.pitch}"\n\nJudge feedback:\n${feedbackSummary}\n\nCrowd sentiment: ${crowdScore.sentiment} (${crowdScore.energy}% energy)\n\nPivot — make it work:` },
  ], { temperature: 0.8, maxTokens: 100 });

  // Update ghost card with pivoted idea
  ghost.originalPitch = ghost.pitch;
  ghost.pitch = content;
  dom.ghostPitch.textContent = content;
  dom.ghostCard.style.borderColor = 'var(--accent)';

  const pivotTrimmed = trimToTime(content, TIMING.phases.pivot);
  log(`PIVOT (${estimateTTS(pivotTrimmed)}s): ${pivotTrimmed}`);
  await speak(pivotTrimmed, { voiceIndex: 3, rate: 1.15, elVoice: CONFIG.elevenlabs.voices.ghost });

  return content;
}

// --- OVERDRIVE ---
async function overdrive(ghost) {
  setPhase('overdrive', 'OVERDRIVE');
  dom.overdrive.style.display = 'block';
  dom.buildLog.textContent = '';

  function buildLog(msg) {
    const ts = ((Date.now() - state.startTime) / 1000).toFixed(1);
    dom.buildLog.textContent += `[${ts}s] ${msg}\n`;
    dom.buildLog.scrollTop = dom.buildLog.scrollHeight;
    log(msg);
  }

  buildLog('OVERDRIVE ENGAGED');
  buildLog(`Building: ${ghost.name}`);
  buildLog(`Original (dud): ${ghost.originalPitch || 'n/a'}`);
  buildLog(`Pivoted pitch: ${ghost.pitch}`);
  buildLog('');
  buildLog('Generating build spec...');

  const { content: spec } = await llmStream(llmPick('reason'), [
    { role: 'system', content: 'You are a senior engineer. Write a brief technical spec for a single-page web app. Include: what it does, the HTML structure, key JS functions needed. Keep it under 200 words. This will be fed to an AI coding agent.' },
    { role: 'user', content: `Build this app: ${ghost.name} — ${ghost.pitch}. It must be a single HTML file with embedded CSS and JS, mobile-friendly, deployable to Cloudflare Pages.` },
  ], { maxTokens: 512, onChunk: (delta) => { dom.buildLog.textContent += delta; dom.buildLog.scrollTop = dom.buildLog.scrollHeight; } });

  buildLog('');
  buildLog('Spec generated');
  buildLog('');
  buildLog('Triggering build agent via Jira...');
  buildLog('');
  buildLog('=== BUILD SPEC READY ===');
  buildLog('Waiting for agent to build and deploy...');
  buildLog(`Target: https://${ghost.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${CONFIG.overdrive.deployDomain}`);

  await speak(`Building ${ghost.name}. Stand by.`, { rate: 0.9, pitch: 0.7, elVoice: CONFIG.elevenlabs.voices.boo });
}

// --- MAIN SHOW FLOW ---
// New flow: 1 ghost → dud pitch → crowd feedback → judge feedback → pivot → OVERDRIVE
async function runShow() {
  state.startTime = Date.now();
  dom.btnStart.style.display = 'none';
  dom.btnSkip.style.display = 'inline-block';

  await initMic();

  // Boo intro
  setPhase('intro', 'BOO MC');
  log('Boo taking the stage...');
  await booSpeak(
    "Welcome, mortals. A ghost is about to pitch a terrible idea. " +
    "Cheer, boo, scream. The judges will roast it. " +
    "Then we fix it and build it live. Let the haunting begin."
  );

  // Generate ghosts (fan-out still runs, but we pick the first one)
  await generateGhosts();
  const ghost = state.ghosts[0];
  state.currentGhostIdx = 0;

  // Ghost pitches the dud
  setPhase('pitch', 'GHOST PITCH');
  dom.ghostCard.classList.remove('hidden');
  dom.ghostName.textContent = ghost.name;
  dom.ghostType.textContent = ghost.type;
  dom.ghostPitch.textContent = ghost.pitch;
  log(`Ghost: ${ghost.name}`);

  await speak(`I am ${ghost.name}. ${ghost.pitch}`, { voiceIndex: 1, rate: 1.15, elVoice: CONFIG.elevenlabs.voices.ghost });

  // Crowd reacts
  const crowdScore = await listenToCrowd();

  // Judges give feedback (constructive roast)
  setPhase('feedback', 'JUDGE FEEDBACK');
  const feedbackSummary = await getJudgeFeedback(ghost, crowdScore);

  // Ghost pivots
  const pivotedPitch = await pivotGhost(ghost, feedbackSummary, crowdScore);

  // Boo closes the show
  const timeLeft = showTimeLeft();
  if (timeLeft > 10) {
    await booSpeak("The ghost has been redeemed. The idea lives. That's the show, mortals.");
  } else {
    await booSpeak("Redeemed.");
  }

  setPhase('done', 'SHOW COMPLETE');
  log(`Show complete in ${((Date.now() - state.startTime) / 1000).toFixed(1)}s`);
}
