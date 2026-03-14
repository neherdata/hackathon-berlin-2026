// ============================================================
// SHOW RUNNER — James's zone
// Judging, crowd detection, Boo MC, chaos judges, OVERDRIVE
// Depends on: CONFIG, state, dom, log(), setPhase(), speak(),
//             llmCall(), llmJSON(), llmStream(), llmPick(),
//             generateGhosts(), initMic(), listenToCrowd()
// ============================================================

// --- BOO: MC, Audience Judge, Announcer ---
const BOO = {
  name: 'Boo',
  voiceIdx: 0,
  pitch: 0.6,
  rate: 1.1,
  backstory: 'You are Boo, the Ghost Host. You are the MC, the audience\'s voice, and the final announcer. You interpret crowd energy — cheers, boos, silence — and translate it into ghost verdicts. You are theatrical, dramatic, and a little unhinged. You love chaos.',
};

async function booSpeak(text) {
  await speak(text, { voiceIndex: BOO.voiceIdx, rate: BOO.rate, pitch: BOO.pitch });
}

async function booJudge(ghost, crowdScore) {
  const crowdText = crowdScore.sentiment === 'cheer' ? 'The living ROARED with approval!'
    : crowdScore.sentiment === 'boo' ? 'The living have REJECTED this ghost!'
    : crowdScore.sentiment === 'dead' ? 'Nothing. Not a sound. The living don\'t care.'
    : 'The living are... confused.';

  const { content } = await llmCall(llmPick('fast'), [
    { role: 'system', content: `${BOO.backstory} Speak as Boo. ONE dramatic sentence about the crowd's reaction. Channel the energy.` },
    { role: 'user', content: `The crowd just reacted to "${ghost.name}": ${crowdText} Energy: ${crowdScore.energy}%. Translate this for the judges.` },
  ], { temperature: 0.9, maxTokens: 50 });

  return content;
}

// --- CHAOS JUDGES ---
async function summonChaosJudges(ghost) {
  log('Boo is summoning chaos judges...');
  setPhase('chaos', 'SUMMONING CHAOS');

  const result = await llmJSON(llmPick('reason'), [
    { role: 'system', content: 'Generate 2 absurd ghost judge characters in JSON array. Each has a name, a ridiculous backstory (1 sentence — how they died), and what they judge (1 sentence). Be unhinged and funny. Return ONLY a JSON array, no markdown.' },
    { role: 'user', content: `These judges are evaluating: "${ghost.name}" — ${ghost.pitch}. Make them relevant but absurd.` },
  ], { temperature: 1.0, maxTokens: 256 });

  if (result.parsed && Array.isArray(result.parsed)) {
    return result.parsed.slice(0, 2).map((j, i) => ({
      name: j.name || `Chaos Ghost ${i + 1}`,
      backstory: j.backstory || 'Died of pure chaos.',
      judges: j.judges || j.what_they_judge || 'vibes',
      voiceIdx: 8 + i,
    }));
  }
  return [
    { name: 'Gary the Unpredictable', backstory: 'Died by tripping over a USB cable.', judges: 'whether the name sounds cool', voiceIdx: 8 },
    { name: 'The Void', backstory: 'Was never born. Just appeared.', judges: 'cosmic relevance', voiceIdx: 9 },
  ];
}

// --- JUDGE DELIBERATION ---
async function judgeGhost(ghost, crowdScore, round = 1) {
  const models = Object.values(CONFIG.featherless.models.judges);
  const coreJudges = CONFIG.judges.map((j, i) => ({
    ...j,
    model: models[i % models.length],
    style: j.backstory,
  }));

  dom.judgePanel.innerHTML = '';
  dom.judgePanel.classList.remove('hidden');

  // Boo announces crowd reaction first
  const booVerdict = await booJudge(ghost, crowdScore);
  const booCard = document.createElement('div');
  booCard.className = 'judge-card';
  booCard.style.borderColor = 'var(--warn)';
  booCard.innerHTML = `<h3 style="color: var(--warn)">Boo (The Crowd)</h3><div class="verdict">${booVerdict}</div>`;
  dom.judgePanel.appendChild(booCard);
  setPhase('judging', 'BOO SPEAKS');
  await booSpeak(booVerdict);

  const crowdContext = `Boo, the audience ghost, says: "${booVerdict}" (crowd energy: ${crowdScore.energy}%, sentiment: ${crowdScore.sentiment})`;

  const roundContext = round === 2
    ? 'This is your FINAL deliberation. You must reach a BUILD or NO BUILD verdict. Be decisive.'
    : 'Give your initial take. ONE sentence only — punchy and decisive.';

  // Core judges
  for (const judge of coreJudges) {
    const card = document.createElement('div');
    card.className = 'judge-card';
    card.innerHTML = `<h3>${judge.name}</h3><div class="verdict">Thinking...</div>`;
    dom.judgePanel.appendChild(card);

    const { content } = await llmCall(judge.model, [
      { role: 'system', content: `You are ${judge.name}, a ghost judge at a hackathon. ${judge.style} Speak in first person as a ghost. ONE sentence only — punchy and decisive. ${roundContext}` },
      { role: 'user', content: `Ghost pitch: "${ghost.name}" — ${ghost.pitch}\n\n${crowdContext}\n\nYour verdict (ONE sentence):` },
    ], { temperature: 0.7, maxTokens: 60 });

    card.querySelector('.verdict').textContent = content;
    setPhase('judging', `JUDGE: ${judge.name.toUpperCase()}`);
    await speak(content, { voiceIndex: judge.voiceIdx, rate: 1.2 });
  }

  // Round 2: summon chaos judges
  if (round === 2) {
    const chaosJudges = await summonChaosJudges(ghost);
    for (const chaos of chaosJudges) {
      const card = document.createElement('div');
      card.className = 'judge-card';
      card.style.borderColor = 'var(--danger)';
      card.innerHTML = `<h3 style="color: var(--danger)">${chaos.name}</h3><div class="ghost-type">${chaos.backstory}</div><div class="verdict">Channeling...</div>`;
      dom.judgePanel.appendChild(card);

      const { content } = await llmCall(llmPick('random'), [
        { role: 'system', content: `You are ${chaos.name}, a chaos ghost judge. ${chaos.backstory} You judge: ${chaos.judges}. ONE sentence verdict — be chaotic and funny.` },
        { role: 'user', content: `Ghost pitch: "${ghost.name}" — ${ghost.pitch}\n${crowdContext}\nYour chaotic verdict:` },
      ], { temperature: 1.0, maxTokens: 50 });

      card.querySelector('.verdict').textContent = content;
      setPhase('judging', `CHAOS: ${chaos.name.toUpperCase()}`);
      await speak(content, { voiceIndex: chaos.voiceIdx, rate: 1.3 });
    }
  }
}

// --- BUILD DECISION ---
async function decideBuild(ghost, scores) {
  const scoresSummary = scores.map((s, i) =>
    `Round ${i + 1}: ${s.sentiment} (${s.energy}%)`
  ).join(', ');

  const { content } = await llmCall(llmPick('reason'), [
    { role: 'system', content: `You are Boo, the Ghost Host. ${BOO.backstory} Based on crowd reactions and judge verdicts, announce the FINAL verdict. Start with "BUILD!" or "NO BUILD!" Be dramatic. One sentence.` },
    { role: 'user', content: `Ghost: "${ghost.name}" — ${ghost.pitch}\nCrowd scores: ${scoresSummary}\nThe judges have deliberated. Your final announcement:` },
  ], { temperature: 0.6, maxTokens: 80 });

  log(`BOO VERDICT: ${content}`);
  setPhase('verdict', content.toUpperCase().includes('BUILD!') && !content.toUpperCase().includes('NO BUILD') ? 'BUILD!' : 'NO BUILD');
  await booSpeak(content);

  return content.toUpperCase().includes('BUILD') && !content.toUpperCase().includes('NO BUILD');
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
  buildLog(`Pitch: ${ghost.pitch}`);
  buildLog('');
  buildLog('Generating build spec...');

  const { content: spec } = await llmStream(llmPick('reason'), [
    { role: 'system', content: 'You are a senior engineer. Write a brief technical spec for a single-page web app. Include: what it does, the HTML structure, key JS functions needed. Keep it under 200 words. This will be fed to an AI coding agent.' },
    { role: 'user', content: `Build this app: ${ghost.name} — ${ghost.pitch}. It must be a single HTML file with embedded CSS and JS, mobile-friendly, deployable to Cloudflare Pages.` },
  ], { maxTokens: 512, onChunk: (delta) => { dom.buildLog.textContent += delta; dom.buildLog.scrollTop = dom.buildLog.scrollHeight; } });

  buildLog('Spec generated');
  buildLog('');
  buildLog('Triggering build agent via Jira...');
  buildLog('');
  buildLog('=== BUILD SPEC READY ===');
  buildLog('Waiting for agent to build and deploy...');
  buildLog(`Target: https://${ghost.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${CONFIG.overdrive.deployDomain}`);

  await speak(`Overdrive engaged. Building ${ghost.name}. Stand by.`, { rate: 0.9, pitch: 0.7 });
}

// --- MAIN SHOW FLOW ---
async function runShow() {
  state.startTime = Date.now();
  dom.btnStart.style.display = 'none';
  dom.btnSkip.style.display = 'inline-block';

  await initMic();

  // Boo intro
  setPhase('intro', 'BOO MC');
  log('Boo taking the stage...');
  await booSpeak(
    "Welcome, mortals. Startup ghosts are about to pitch you. " +
    "Cheer if you love it. Boo if you hate it. Silence kills. " +
    "If a ghost survives... we build it live. Let the haunting begin."
  );

  await generateGhosts();

  for (let i = 0; i < state.ghosts.length; i++) {
    state.currentGhostIdx = i;
    const ghost = state.ghosts[i];

    // Pitch
    setPhase('pitch', 'GHOST PITCH');
    dom.ghostCard.classList.remove('hidden');
    dom.ghostName.textContent = ghost.name;
    dom.ghostType.textContent = ghost.type;
    dom.ghostPitch.textContent = ghost.pitch;
    log(`Ghost ${i + 1}/${state.ghosts.length}: ${ghost.name}`);

    await speak(`I am ${ghost.name}. ${ghost.pitch}`, { voiceIndex: (i * 2 + 1) % 8, rate: 1.15 });

    // Crowd #1
    const crowd1 = await listenToCrowd();

    if (crowd1.energy < CONFIG.crowd.dudThreshold) {
      log(`DUD — ghost banished (energy: ${crowd1.energy}%)`);
      await booSpeak("Banished.");
      dom.ghostCard.classList.add('hidden');
      dom.crowdMeter.style.display = 'none';
      continue;
    }

    // Judging Round 1
    setPhase('judging', 'JUDGING ROUND 1');
    await judgeGhost(ghost, crowd1, 1);

    // Crowd #2
    await booSpeak("Your turn.");
    const crowd2 = await listenToCrowd();

    // Final Deliberation
    setPhase('deliberation', 'FINAL DELIBERATION');
    await judgeGhost(ghost, crowd2, 2);

    // BUILD or NO BUILD
    const shouldBuild = await decideBuild(ghost, [crowd1, crowd2]);

    if (shouldBuild) {
      await overdrive(ghost);
      break;
    } else {
      await booSpeak("Next ghost.");
      dom.ghostCard.classList.add('hidden');
      dom.judgePanel.classList.add('hidden');
      dom.crowdMeter.style.display = 'none';
    }
  }
}
