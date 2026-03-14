// ============================================================
// GHOST GENERATION — DeepSeek-V3-0324 optimized, ultra-specific buildHints
// generateDud() kept for compatibility but show.js uses pickDud()
// generateBuildable() is the only live LLM call — runs during intro TTS
// Depends on: CONFIG, state, log(), setPhase(), llmJSON(), llmPick()
// ============================================================

const GHOST_ARCHETYPES = [
  'a burned-out Berlin startup founder who died pitching to VCs at 3am',
  'a rogue AI researcher who was deleted by their own experiment',
  'a fintech bro who died when his blockchain wallet ate his soul',
  'a hardcore hardware engineer who died soldering at Berlin CCC',
  'a failed influencer who died of zero engagement',
  'a data privacy lawyer who was GDPR-d out of existence',
  'an overly ambitious PM who died under a mountain of Jira tickets',
  'a DevOps ghost who died in a recursive deployment loop',
  'a Berlin club bouncer who pivoted to tech and died debugging CSS at Berghain',
  'a food delivery rider who became sentient and now wants to disrupt logistics',
  'a retired professor from TU Berlin who died mid-lecture about neural networks',
  'a ghost who built DeadIn — LinkedIn for ghosts — died when no one endorsed their synergistic possession skill',
  'a ghost who built GhostGPT — an AI that hallucinates on purpose — died when it told them their startup was a good idea',
  'a ghost who built Hauntr — Tinder for people who died in the same house — died of unresolved trauma',
  'a ghost who built SpookifyAI — Airbnb for haunted locations — died asset-light because ghosts own nothing',
  'a ghost who built SaaSéance — B2B séance platform with API tiers: Whisper, Wail, Full Possession — died on a free trial',
  'a ghost who built HexHub — GitHub for curses — died in a merge conflict',
  'a ghost who built PhantomOps — DevOps for hauntings — died in a recursive deploy',
  'a ghost who built ScreamAI — ML that learns your deepest fears — died when it learned theirs',
  'a ghost who built DeathFlow — Notion for the afterlife — died with 47 open tasks',
];

// Ultra-specific buildHint templates — the LLM picks one and customizes it
// This makes buildProject() WAY faster because it has exact instructions
const BUILD_TEMPLATES = [
  'Leaflet.js map with 10+ Berlin markers, popup cards, dark tile layer, filter buttons',
  'Chart.js dashboard with 3 charts (bar, line, pie), animated counters, dark theme grid',
  'Kanban board with drag-drop columns, localStorage save, ghost-themed cards, CSS grid',
  'Real-time voting page with emoji buttons, animated bar chart, WebSocket-style polling',
  'Quiz app with 5 questions, progress bar, score reveal animation, share button',
  'Timeline/feed with scrolling cards, like buttons, ghost avatar SVGs, infinite scroll feel',
];

const BUILDABLE_SEED = `Single HTML file web app. Must use one of these exact patterns: ${BUILD_TEMPLATES.join(' | ')}. CDN deps OK (Leaflet, Chart.js). Berlin-themed, dark background #0a0a0f.`;

const FAILSAFE_GHOST = {
  name: 'Der Speisekarten-Geist',
  type: 'The Ghost of Bad Translations',
  pitch: 'Point your phone at any German restaurant menu and get instant cultural translations.',
  tagline: 'Lost in translation? This ghost eats menus for breakfast.',
  buildHint: 'Leaflet.js map with 10+ Berlin restaurant markers, popup cards with translation, dark tile layer',
};

// Kept for compatibility — show.js uses pickDud() instead
async function generateDud() {
  log('GEN: dud pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];
  const result = await llmJSON('deepseek-ai/DeepSeek-V3-0324', [
    { role: 'system', content: `<role>Dead startup founder, Berlin hackathon</role>
<task>TERRIBLE, funny, useless startup idea</task>
<rules>JSON only, no markdown, 1 sentence pitch</rules>
<output_schema>{"name":"string","type":"string","pitch":"string","tagline":"string"}</output_schema>` },
    { role: 'user', content: `<archetype>${archetype}</archetype>
<example>{"name":"Phantomwire","type":"The Ghost of Dead Startups","pitch":"A blockchain that only stores regrets.","tagline":"Immutable sadness."}</example>` },
  ], { temperature: 1.0, maxTokens: 100 });
  if (result.parsed) return result.parsed;
  return { name: 'Error Ghost', type: 'The Ghost of Bad APIs', pitch: 'An AI that generates other AIs. AIs all the way down.', tagline: 'Recursion as a service.' };
}

// THE critical path — runs during intro TTS, ~4s on DeepSeek-V3-0324
// buildHint is ultra-specific so buildProject() generates code faster
async function generateBuildable() {
  log('GEN: buildable pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];
  const template = BUILD_TEMPLATES[Math.floor(Math.random() * BUILD_TEMPLATES.length)];

  const result = await llmJSON('deepseek-ai/DeepSeek-V3-0324', [
    { role: 'system', content: `<role>Dead startup founder haunting a Berlin hackathon</role>
<task>Generate a GENUINELY GOOD web app idea that fits this exact build template</task>
<build_template>${template}</build_template>
<rules>JSON only. No markdown. buildHint MUST start with the exact tech stack from build_template.</rules>
<output_schema>{"name":"string","type":"string","pitch":"string","tagline":"string","buildHint":"string"}</output_schema>` },
    { role: 'user', content: `<archetype>${archetype}</archetype>
<example>{"name":"Der Kartengeist","type":"The Ghost of Lost Tourists","pitch":"Interactive Berlin map showing startup events and hackathons with ghost ratings.","tagline":"Navigate Berlin like you haunt it.","buildHint":"Leaflet.js map with 10+ Berlin markers, popup cards, dark tile layer, filter buttons"}</example>` },
  ], { temperature: 0.85, maxTokens: 150 });

  if (result.parsed) {
    log(`GEN: "${result.parsed.name}" ready`);
    return result.parsed;
  }
  log('GEN: fallback to failsafe');
  return FAILSAFE_GHOST;
}

// Parallel generation — kept for compatibility
async function generateGhosts() {
  setPhase('generating', 'SUMMONING GHOSTS');
  log('Summoning ghosts (parallel)...');
  const [dud, buildable] = await Promise.all([generateDud(), generateBuildable()]);
  state.ghosts = [dud, buildable];
  log(`Dud: "${dud.name}" | Buildable: "${buildable.name}"`);
  return state.ghosts;
}
