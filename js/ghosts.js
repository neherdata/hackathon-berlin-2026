// ============================================================
// GHOST GENERATION — Dev 2's zone
// Depends on: CONFIG, state, log(), setPhase(), llmFanOut()
// ============================================================

// Ghost archetypes — each model gets a different personality seed
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
];

// Ghost generation prompt — rich, personality-driven
const GHOST_PROMPT = {
  system: `You are a dead startup founder haunting a tech hackathon in Berlin, March 2026. You died in a ridiculous tech-related way and now you channel your unfinished business into ONE startup idea.

Rules:
- Your pitch must be a REAL, buildable idea (not a joke product)
- Your ghost personality should shine through the pitch
- Berlin/Europe context is a plus but not required
- Be creative, funny, and a little unhinged
- Return ONLY valid JSON, no markdown, no code fences`,

  user: (archetype) => `You are ${archetype}.

Generate your ghost character and startup pitch as JSON:
{"name": "Your Ghost Name (creative, spooky-funny)", "type": "The Ghost of [something relevant to how you died]", "pitch": "Your 2-3 sentence startup pitch. Make it compelling — the audience will cheer or boo you, and ghost judges will decide if it gets BUILT LIVE on stage.", "tagline": "One killer tagline that haunts the audience"}`,
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

  // Each model gets a different archetype for variety
  const calls = models.map((model, i) => {
    const archetype = GHOST_ARCHETYPES[i % GHOST_ARCHETYPES.length];
    const messages = [
      { role: 'system', content: GHOST_PROMPT.system },
      { role: 'user', content: GHOST_PROMPT.user(archetype) },
    ];
    return { model, messages };
  });

  // Fan out with concurrency limit (Featherless allows 4 concurrent, keep 1 free)
  const concurrency = 3;
  log(`Fan-out across ${calls.length} models (max ${concurrency} concurrent)...`);
  const results = [];
  const queue = [...calls];

  async function worker() {
    while (queue.length > 0) {
      const { model, messages } = queue.shift();
      try {
        const result = await llmJSON(model, messages, { temperature: 0.95, maxTokens: 300, quiet: true });
        results.push(result);
      } catch (e) {
        log(`${model.split('/').pop()} failed: ${e.message}`);
        results.push(null);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, calls.length) }, () => worker()));
  const successes = results.filter(r => r && r.parsed);
  log(`Fan-out: ${successes.length}/${calls.length} succeeded`);

  state.ghosts = successes.map(r => r.parsed);

  // Always add failsafe last
  state.ghosts.push(FAILSAFE_GHOST);

  log(`${state.ghosts.length} ghosts summoned`);
  return state.ghosts;
}
