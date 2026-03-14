// ============================================================
// GHOST GENERATION — seeded pitch engine
// FASTEST models, minimal tokens — speed is everything
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

const BUILDABLE_SEED = `Simple, visual, interactive web app. Single HTML file. Think: Berlin startup map, voting dashboard, ghost todo app, haunted location finder. One self-contained HTML page with embedded JS and CSS.`;

const FAILSAFE_GHOST = {
  name: 'Der Speisekarten-Geist',
  type: 'The Ghost of Bad Translations',
  pitch: 'Point your phone at any German restaurant menu and get instant cultural translations.',
  tagline: 'Lost in translation? This ghost eats menus for breakfast.',
};

// FASTEST model, minimal tokens
async function generateDud() {
  log('GEN: dud pitch (fast)...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];
  const result = await llmJSON(llmPick('fast'), [
    { role: 'system', content: 'Dead startup founder, Berlin hackathon. TERRIBLE startup idea — useless, over-engineered, funny. JSON only, no markdown.' },
    { role: 'user', content: `You are ${archetype}.\nJSON: {"name":"Ghost Name","type":"The Ghost of X","pitch":"1 sentence terrible idea","tagline":"tagline"}` },
  ], { temperature: 1.0, maxTokens: 120 });
  if (result.parsed) return result.parsed;
  return { name: 'Error Ghost', type: 'The Ghost of Bad APIs', pitch: 'An AI that generates other AIs. AIs all the way down.', tagline: 'Recursion as a service.' };
}

// FASTEST model + XML one-shot for reliable JSON
async function generateBuildable() {
  log('GEN: buildable pitch (fast)...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];
  const result = await llmJSON(llmPick('fast'), [
    { role: 'system', content: `<role>Dead startup founder haunting a Berlin hackathon</role>
<task>Generate a GENUINELY GOOD, buildable web app idea</task>
<constraints>${BUILDABLE_SEED}</constraints>
<rules>Respond with ONLY a JSON object. No markdown. 1 sentence pitch. 1 sentence buildHint.</rules>
<output_schema>{"name":"string","type":"string","pitch":"string","tagline":"string","buildHint":"string"}</output_schema>` },
    { role: 'user', content: `<archetype>${archetype}</archetype>
<example>{"name":"Der Kartengeist","type":"The Ghost of Lost Tourists","pitch":"Interactive Berlin map showing real-time startup events and hackathons with ghost ratings.","tagline":"Navigate Berlin like you haunt it.","buildHint":"Leaflet.js map with marker popups, dark theme, embedded mock data"}</example>` },
  ], { temperature: 0.85, maxTokens: 150 });
  if (result.parsed) return result.parsed;
  return FAILSAFE_GHOST;
}

// Generate both in PARALLEL — both use fast model, 2 concurrent slots
async function generateGhosts() {
  setPhase('generating', 'SUMMONING GHOSTS');
  log('Summoning ghosts (parallel, fast models)...');
  const [dud, buildable] = await Promise.all([generateDud(), generateBuildable()]);
  state.ghosts = [dud, buildable];
  log(`Dud: "${dud.name}" | Buildable: "${buildable.name}"`);
  return state.ghosts;
}
