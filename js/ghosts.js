// ============================================================
// GHOST GENERATION — seeded pitch engine
// Generates a DUD pitch (intentionally bad) and a BUILDABLE pitch
// (seeded with a direction, but LLM generates it live)
// Depends on: CONFIG, state, log(), setPhase(), llmJSON(), llmPick()
// ============================================================

// Ghost archetypes — personality seeds
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
  'a ghost who built DeadIn — LinkedIn for ghosts — and died when no one endorsed their "synergistic possession" skill',
  'a ghost who built GhostGPT — an AI that hallucinates on purpose as a feature — and died when it told them their startup was a good idea',
  'a ghost who built Hauntr — Tinder for people who died in the same house — and died of an unresolved trauma they charged users for',
  'a ghost who built SpookifyAI — Airbnb for haunted locations — and died asset-light because ghosts own nothing',
  'a ghost who built CurseBase — Airtable for cursed artifact portfolio management — and died when their hex pipeline SLA missed',
  'a ghost who built SaaSéance — a B2B séance platform with API tiers: Whisper, Wail, Full Possession — and died on a free trial',
  'a ghost who built HexHub — GitHub for curses with open-source hex libraries — and died in a merge conflict',
  'a ghost who built PhantomOps — DevOps for hauntings with scream velocity dashboards — and died in a recursive deployment loop',
  'a ghost who built ScreamAI — ML that learns your deepest fears and optimises terror delivery — and died when it learned theirs',
  'a ghost who built ChainGPT — an autonomous AI agent that haunts competitor infrastructure — and died when it turned on them',
  'a ghost who built DeathFlow — Notion for the afterlife delegating dead peoples tasks to the living — and died with 47 open tasks',
];

// Seed for the BUILDABLE pitch — steers LLM toward a known-good direction
// but the LLM generates the actual idea, pitch, and personality
const BUILDABLE_SEED = `The idea should be a simple, visual, interactive web app that could realistically be built in under 5 minutes as a single HTML file. Think: an interactive Berlin startup map, a real-time voting dashboard, a ghost-themed todo app, or a haunted location finder. It MUST be something a code-generating AI can build as one self-contained HTML page with embedded JS and CSS.`;

// Failsafe ghost — always available
const FAILSAFE_GHOST = {
  name: 'Der Speisekarten-Geist',
  type: 'The Ghost of Bad Translations',
  pitch: 'Point your phone at any German restaurant menu and get instant cultural translations. Not just words — context, allergens, local tips, and pronunciation.',
  tagline: 'Lost in translation? This ghost eats menus for breakfast.',
};

// Generate a DUD ghost (intentionally bad idea)
async function generateDud() {
  log('Generating dud pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];

  const result = await llmJSON(llmPick('fast'), [
    { role: 'system', content: `You are a dead startup founder at a hackathon in Berlin. You died in a ridiculous way. Generate a TERRIBLE startup idea — something that sounds impressive but is completely useless, over-engineered, or solves a non-problem. Make it funny. Return ONLY valid JSON, no markdown.` },
    { role: 'user', content: `You are ${archetype}.\n\nGenerate your ghost and your TERRIBLE startup pitch as JSON:\n{"name": "Ghost Name", "type": "The Ghost of [something]", "pitch": "1-2 sentence terrible idea", "tagline": "One terrible tagline"}` },
  ], { temperature: 1.0, maxTokens: 200 });

  if (result.parsed) return result.parsed;
  return { name: 'Error Ghost', type: 'The Ghost of Bad APIs', pitch: 'An AI that generates other AIs that generate other AIs. It is AIs all the way down.', tagline: 'Recursion as a service.' };
}

// Generate a BUILDABLE ghost (seeded with good direction)
async function generateBuildable() {
  log('Seeding buildable pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];

  const result = await llmJSON(llmPick('reason'), [
    { role: 'system', content: `You are a dead startup founder at a hackathon in Berlin. You died in a ridiculous way but your idea is ACTUALLY GOOD. ${BUILDABLE_SEED} Return ONLY valid JSON, no markdown.` },
    { role: 'user', content: `You are ${archetype}.\n\nGenerate your ghost and a GENUINELY GOOD startup pitch as JSON:\n{"name": "Ghost Name", "type": "The Ghost of [something]", "pitch": "2-3 sentence compelling pitch for a buildable webapp", "tagline": "One killer tagline", "buildHint": "1 sentence technical description of what to build — single HTML file with embedded CSS/JS"}` },
  ], { temperature: 0.85, maxTokens: 300 });

  if (result.parsed) return result.parsed;
  return FAILSAFE_GHOST;
}

// Generate both pitches in parallel
async function generateGhosts() {
  setPhase('generating', 'SUMMONING GHOSTS');
  log('Summoning ghosts from the model swarm...');

  // Sequential to respect Featherless concurrency limit
  const dud = await generateDud();
  const buildable = await generateBuildable();

  state.ghosts = [dud, buildable];
  log(`Dud: "${dud.name}" | Buildable: "${buildable.name}"`);
  return state.ghosts;
}
