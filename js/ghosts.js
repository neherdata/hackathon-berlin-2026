// ============================================================
// GHOST GENERATION — DeepSeek-V3-0324 optimized
// XML-structured prompts for fastest, most reliable JSON output
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
  'a ghost who built PhantomOps — DevOps for hauntings with scream velocity dashboards — died in a recursive deploy',
  'a ghost who built ScreamAI — ML that learns your deepest fears — died when it learned theirs',
  'a ghost who built DeathFlow — Notion for the afterlife — died with 47 open tasks',
];

const BUILDABLE_SEED = `Simple, visual, interactive single-HTML web app. Examples: Berlin startup map, real-time voting dashboard, ghost-themed todo, haunted location finder. Must be buildable by AI in 5 minutes.`;

const FAILSAFE_GHOST = {
  name: 'Der Speisekarten-Geist',
  type: 'The Ghost of Bad Translations',
  pitch: 'Point your phone at any German restaurant menu and get instant cultural translations.',
  tagline: 'Lost in translation? This ghost eats menus for breakfast.',
};

// DeepSeek-V3-0324 optimized — XML tags for structure, minimal tokens
async function generateDud() {
  log('GEN: dud pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];

  const result = await llmJSON('deepseek-ai/DeepSeek-V3-0324', [
    { role: 'system', content: `<role>Dead startup founder haunting a Berlin hackathon</role>
<task>Generate a TERRIBLE, funny, useless startup idea</task>
<rules>
- Respond with ONLY a JSON object
- No markdown, no explanation, no code fences
- Keep pitch to 1 sentence max
</rules>
<output_schema>{"name":"string","type":"string","pitch":"string","tagline":"string"}</output_schema>` },
    { role: 'user', content: `<archetype>${archetype}</archetype>
<example>{"name":"Phantomwire","type":"The Ghost of Dead Startups","pitch":"A blockchain that only stores regrets.","tagline":"Immutable sadness."}</example>` },
  ], { temperature: 1.0, maxTokens: 120 });

  if (result.parsed) return result.parsed;
  return { name: 'Error Ghost', type: 'The Ghost of Bad APIs', pitch: 'An AI that generates other AIs. AIs all the way down.', tagline: 'Recursion as a service.' };
}

async function generateBuildable() {
  log('GEN: buildable pitch...');
  const archetype = GHOST_ARCHETYPES[Math.floor(Math.random() * GHOST_ARCHETYPES.length)];

  const result = await llmJSON('deepseek-ai/DeepSeek-V3-0324', [
    { role: 'system', content: `<role>Dead startup founder haunting a Berlin hackathon</role>
<task>Generate a GENUINELY GOOD, buildable web app idea</task>
<constraints>${BUILDABLE_SEED}</constraints>
<rules>
- Respond with ONLY a JSON object
- No markdown, no explanation, no code fences
- Pitch: 1-2 sentences, compelling
- buildHint: 1 sentence technical spec for a single HTML file
</rules>
<output_schema>{"name":"string","type":"string","pitch":"string","tagline":"string","buildHint":"string"}</output_schema>` },
    { role: 'user', content: `<archetype>${archetype}</archetype>
<example>{"name":"Der Kartengeist","type":"The Ghost of Lost Tourists","pitch":"Interactive Berlin map showing real-time startup events, hackathons, and meetups with ghost ratings.","tagline":"Navigate Berlin like you haunt it.","buildHint":"Leaflet.js map with marker popups, dark theme, embedded mock data"}</example>` },
  ], { temperature: 0.85, maxTokens: 180 });

  if (result.parsed) return result.parsed;
  return FAILSAFE_GHOST;
}

// Parallel generation — both hit DeepSeek-V3-0324 simultaneously
async function generateGhosts() {
  setPhase('generating', 'SUMMONING GHOSTS');
  log('Summoning ghosts (DeepSeek-V3-0324, parallel)...');
  const [dud, buildable] = await Promise.all([generateDud(), generateBuildable()]);
  state.ghosts = [dud, buildable];
  log(`Dud: "${dud.name}" | Buildable: "${buildable.name}"`);
  return state.ghosts;
}
