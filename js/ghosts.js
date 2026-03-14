// ============================================================
// GHOST GENERATION — Dev 2's zone
// Depends on: CONFIG, state, log(), setPhase(), llmFanOut()
// ============================================================

// Ghost generation prompt — edit this to shape ghost personalities
const GHOST_PROMPT = {
  system: 'You are a creative ghost at a hackathon. Return only valid JSON.',
  user: `You are a ghost haunting a tech hackathon in Berlin. Generate ONE creative startup idea as a ghost character.

Return ONLY valid JSON (no markdown, no code fences):
{"name": "Ghost Name (spooky/funny)", "type": "The Ghost of [something]", "pitch": "2-3 sentence startup pitch", "tagline": "One catchy line"}`,
};

// Failsafe ghost — always added last
const FAILSAFE_GHOST = {
  name: 'Der Speisekarten-Geist',
  type: 'The Ghost of Bad Translations',
  pitch: 'Point your phone at any German restaurant menu and get instant cultural translations. Not just words — context, allergens, local tips, and pronunciation. Never order Handkäse by accident again.',
  tagline: 'Lost in translation? This ghost eats menus for breakfast.',
};

async function generateGhosts() {
  setPhase('generating', 'SUMMONING GHOSTS');
  log('Summoning ghosts from the model swarm...');

  const models = CONFIG.featherless.models.corpus;
  const messages = [
    { role: 'system', content: GHOST_PROMPT.system },
    { role: 'user', content: GHOST_PROMPT.user },
  ];

  // Fan out to all models, parse JSON responses
  const results = await llmFanOut(models, messages, { temperature: 0.9, maxTokens: 256, parseJSON: true });
  state.ghosts = results.map(r => r.parsed);

  // Always add failsafe last
  state.ghosts.push(FAILSAFE_GHOST);

  log(`${state.ghosts.length} ghosts summoned`);
  return state.ghosts;
}
