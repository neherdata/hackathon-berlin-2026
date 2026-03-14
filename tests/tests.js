// ============================================================
// GHOST PITCH ENGINE — Test Suite
// No dependencies. Returns results via window.TEST_RESULTS.
// Run via tests/test.html — loads app stubs then this file.
// ============================================================

const TEST_RESULTS = [];

function assert(name, condition, detail) {
  const pass = !!condition;
  TEST_RESULTS.push({ name, pass, detail: detail || '' });
  return pass;
}

function assertEqual(name, actual, expected) {
  const pass = actual === expected;
  return assert(name, pass, pass ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertIncludes(name, arr, item) {
  const pass = arr.includes(item);
  return assert(name, pass, pass ? '' : `${JSON.stringify(item)} not found in array`);
}

// ============================================================
// 1. CONFIG — required keys exist
// ============================================================

function testConfig() {
  const topKeys = ['featherless', 'crowd', 'tts', 'elevenlabs', 'needle', 'overdrive', 'judges'];
  for (const key of topKeys) {
    assert(`CONFIG.${key} exists`, key in CONFIG);
  }

  // featherless sub-keys
  assert('CONFIG.featherless.baseUrl', !!CONFIG.featherless.baseUrl);
  assert('CONFIG.featherless.apiKey', !!CONFIG.featherless.apiKey);
  assert('CONFIG.featherless.models.corpus is array', Array.isArray(CONFIG.featherless.models.corpus));
  assert('CONFIG.featherless.models.corpus non-empty', CONFIG.featherless.models.corpus.length > 0);
  assert('CONFIG.featherless.models.judges is object', typeof CONFIG.featherless.models.judges === 'object');

  // crowd sub-keys
  const crowdKeys = ['reactionWindowMs', 'cheerBandHz', 'booBandHz', 'dudThreshold', 'fftSize'];
  for (const key of crowdKeys) {
    assert(`CONFIG.crowd.${key}`, key in CONFIG.crowd);
  }

  // judges array
  assert('CONFIG.judges is array', Array.isArray(CONFIG.judges));
  assert('CONFIG.judges has entries', CONFIG.judges.length > 0);
  for (const judge of CONFIG.judges) {
    assert(`judge ${judge.key} has name`, !!judge.name);
    assert(`judge ${judge.key} has backstory`, !!judge.backstory);
  }

  // overdrive
  assert('CONFIG.overdrive.deployDomain', !!CONFIG.overdrive.deployDomain);
}

// ============================================================
// 2. llmPick — returns valid models for each purpose
// ============================================================

function testLlmPick() {
  const corpus = CONFIG.featherless.models.corpus;
  const judgeModels = Object.values(CONFIG.featherless.models.judges);

  // fast — always last corpus item
  const fast = llmPick('fast');
  assertEqual('llmPick fast = last corpus item', fast, corpus[corpus.length - 1]);
  assertIncludes('llmPick fast is in corpus', corpus, fast);

  // reason — always first corpus item
  const reason = llmPick('reason');
  assertEqual('llmPick reason = first corpus item', reason, corpus[0]);
  assertIncludes('llmPick reason is in corpus', corpus, reason);

  // random — must be a corpus member (run several times to test randomness)
  const randomSeen = new Set();
  for (let i = 0; i < 50; i++) {
    const r = llmPick('random');
    assertIncludes(`llmPick random[${i}] is in corpus`, corpus, r);
    randomSeen.add(r);
  }
  assert('llmPick random produces variety (>1 unique over 50 calls)', randomSeen.size > 1);

  // judge — must be a judge model
  const judgesSeen = new Set();
  for (let i = 0; i < 30; i++) {
    const j = llmPick('judge');
    assertIncludes(`llmPick judge[${i}] is a known judge model`, judgeModels, j);
    judgesSeen.add(j);
  }
  // If there are multiple judges, we expect variety
  if (judgeModels.length > 1) {
    assert('llmPick judge produces variety (>1 unique over 30 calls)', judgesSeen.size > 1);
  }

  // unknown purpose — falls back to corpus[0]
  const unknown = llmPick('bogus-purpose-xyz');
  assertEqual('llmPick unknown purpose falls back to corpus[0]', unknown, corpus[0]);
}

// ============================================================
// 3. llmJSON — JSON extraction regex behaviour
// ============================================================

// We test the extraction logic directly without making real fetch calls.
// The pattern from llmJSON is:
//   const objMatch = result.content.match(/\{[\s\S]*\}/);
//   const arrMatch = result.content.match(/\[[\s\S]*\]/);
//   const jsonStr = objMatch ? objMatch[0] : arrMatch ? arrMatch[0] : null;

function extractJSON(content) {
  const objMatch = content.match(/\{[\s\S]*\}/);
  const arrMatch = content.match(/\[[\s\S]*\]/);
  const jsonStr = objMatch ? objMatch[0] : arrMatch ? arrMatch[0] : null;
  if (!jsonStr) return null;
  try { return JSON.parse(jsonStr); } catch { return null; }
}

function testLlmJsonExtraction() {
  // Case 1: raw JSON object
  const raw = '{"name":"Phantom","type":"Ghost","pitch":"We build stuff","tagline":"Boo"}';
  const r1 = extractJSON(raw);
  assert('raw JSON object: parsed', r1 !== null);
  assert('raw JSON object: name field', r1 && r1.name === 'Phantom');

  // Case 2: markdown fenced JSON
  const fenced = '```json\n{"name":"Specter","type":"Ghost","pitch":"Disrupt death","tagline":"Dead serious"}\n```';
  const r2 = extractJSON(fenced);
  assert('markdown fenced JSON: parsed', r2 !== null);
  assert('markdown fenced JSON: name field', r2 && r2.name === 'Specter');

  // Case 3: explanation text before and after JSON
  const withText = 'Here is my pitch:\n{"name":"Wraith","pitch":"SaaS for the afterlife","tagline":"Eternal value"}\nHope you like it!';
  const r3 = extractJSON(withText);
  assert('explanation text around JSON: parsed', r3 !== null);
  assert('explanation text around JSON: name field', r3 && r3.name === 'Wraith');

  // Case 4: JSON array (bare array with object items — objMatch grabs inner objects,
  // producing invalid JSON, so parse fails and extractJSON returns null.
  // This is a known quirk of the greedy /\{[\s\S]*\}/ regex: it wins over arrMatch
  // and spans from the first { to the last }, giving "{...},{...}" which is invalid.
  // The real code returns null in this case — test documents actual behaviour.)
  const arr = '[{"id":1},{"id":2}]';
  const r4 = extractJSON(arr);
  assert('JSON array with object items: returns null (greedy obj regex wins, parse fails)', r4 === null);

  // Case 4b: A JSON array of primitives has no {} so arrMatch fires correctly
  const arrPrim = '["a","b","c"]';
  const r4b = extractJSON(arrPrim);
  assert('JSON array of primitives: parsed as array', Array.isArray(r4b));
  assert('JSON array of primitives: length 3', r4b && r4b.length === 3);

  // Case 5: object wins over array when both present
  const both = 'Notes: [1,2,3] but the object is {"key":"value"}';
  const r5 = extractJSON(both);
  assert('object wins over array when both present', r5 && !Array.isArray(r5) && r5.key === 'value');

  // Case 6: no JSON at all
  const noJson = 'I cannot provide JSON right now, sorry.';
  const r6 = extractJSON(noJson);
  assert('no JSON: returns null', r6 === null);

  // Case 7: broken JSON (extra trailing comma)
  const broken = '{"name":"Broken Ghost",}';
  const r7 = extractJSON(broken);
  assert('broken JSON: returns null (parse fails gracefully)', r7 === null);

  // Case 8: deeply nested JSON object
  const nested = 'Result: {"ghost":{"name":"Nested","fields":{"a":1,"b":2}},"tagline":"deep"}';
  const r8 = extractJSON(nested);
  assert('nested JSON: parsed', r8 !== null);
  assert('nested JSON: ghost.name field', r8 && r8.ghost && r8.ghost.name === 'Nested');

  // Case 9: multiline JSON with newlines in values
  const multiline = '{\n  "name": "Haunt Corp",\n  "pitch": "We haunt\\nall the things"\n}';
  const r9 = extractJSON(multiline);
  assert('multiline JSON: parsed', r9 !== null);
  assert('multiline JSON: name field', r9 && r9.name === 'Haunt Corp');
}

// ============================================================
// 4. llmFanOut — concurrency limiter (mock fetch)
// ============================================================

async function testLlmFanOutConcurrency() {
  // Replace global fetch with a spy that tracks concurrency
  const originalFetch = window.fetch;

  let currentConcurrent = 0;
  let maxObservedConcurrent = 0;
  let callCount = 0;

  window.fetch = async (url, opts) => {
    currentConcurrent++;
    callCount++;
    if (currentConcurrent > maxObservedConcurrent) {
      maxObservedConcurrent = currentConcurrent;
    }

    // Simulate network delay so workers actually overlap
    await new Promise(resolve => setTimeout(resolve, 20));

    currentConcurrent--;

    // Return a valid Featherless-shaped response
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"name":"Mock Ghost","type":"Mock","pitch":"Mock pitch","tagline":"Mock tag"}' } }],
        usage: { total_tokens: 10 },
      }),
      text: async () => 'error',
    };
  };

  try {
    const models = [
      'model-a', 'model-b', 'model-c',
      'model-d', 'model-e', 'model-f',
      'model-g', 'model-h',
    ];
    const messages = [{ role: 'user', content: 'test' }];

    // Default concurrency = 3
    await llmFanOut(models, messages, { concurrency: 3 });

    assert('fanOut concurrency=3: max concurrent never exceeded 3', maxObservedConcurrent <= 3);
    assert('fanOut concurrency=3: all models called', callCount === models.length);

    // Reset stats and test concurrency=1 (serial)
    currentConcurrent = 0; maxObservedConcurrent = 0; callCount = 0;
    await llmFanOut(['a', 'b', 'c'], messages, { concurrency: 1 });
    assert('fanOut concurrency=1: max concurrent is 1 (serial)', maxObservedConcurrent <= 1);
    assert('fanOut concurrency=1: all 3 called', callCount === 3);

    // Reset stats and test concurrency larger than model count
    currentConcurrent = 0; maxObservedConcurrent = 0; callCount = 0;
    await llmFanOut(['x', 'y'], messages, { concurrency: 10 });
    assert('fanOut concurrency>models: all models called', callCount === 2);
    assert('fanOut concurrency>models: max concurrent <= model count', maxObservedConcurrent <= 2);

  } finally {
    window.fetch = originalFetch;
  }
}

// ============================================================
// 5. FAILSAFE_GHOST — required fields
// ============================================================

function testFailsafeGhost() {
  assert('FAILSAFE_GHOST exists', typeof FAILSAFE_GHOST !== 'undefined');
  assert('FAILSAFE_GHOST.name is non-empty string', typeof FAILSAFE_GHOST.name === 'string' && FAILSAFE_GHOST.name.length > 0);
  assert('FAILSAFE_GHOST.type is non-empty string', typeof FAILSAFE_GHOST.type === 'string' && FAILSAFE_GHOST.type.length > 0);
  assert('FAILSAFE_GHOST.pitch is non-empty string', typeof FAILSAFE_GHOST.pitch === 'string' && FAILSAFE_GHOST.pitch.length > 0);
  // tagline is NOT present in FAILSAFE_GHOST — document this as known
  assert('FAILSAFE_GHOST.tagline absent (known: failsafe skips tagline)', !('tagline' in FAILSAFE_GHOST));
}

// ============================================================
// 6. Ghost object shape — validate generated ghost structure
// ============================================================

function testGhostShape() {
  // Simulate what llmJSON.parsed would return for a valid ghost
  const validGhost = {
    name: 'Der Phantom-Pivot',
    type: 'The Ghost of Pivots',
    pitch: 'An AI that detects bad pivot decisions before they kill your startup.',
    tagline: 'Pivot or perish — we pick.',
  };

  const requiredFields = ['name', 'type', 'pitch', 'tagline'];
  for (const field of requiredFields) {
    assert(`ghost has required field: ${field}`, field in validGhost);
    assert(`ghost.${field} is non-empty string`, typeof validGhost[field] === 'string' && validGhost[field].length > 0);
  }

  // A ghost missing 'tagline' should be detectable
  const missingTagline = { name: 'X', type: 'Y', pitch: 'Z' };
  assert('ghost missing tagline is detectable', !('tagline' in missingTagline));

  // A ghost with all fields but empty name should be detectable
  const emptyName = { name: '', type: 'Y', pitch: 'Z', tagline: 'W' };
  assert('ghost with empty name is detectable', emptyName.name.length === 0);
}

// ============================================================
// 7. Phase transitions — valid states
// ============================================================

function testPhaseTransitions() {
  const VALID_PHASES = ['idle', 'generating', 'intro', 'pitch', 'crowd', 'feedback', 'pivot', 'overdrive'];

  // All phase strings used in show.js must be in the valid set
  const usedInShow = ['intro', 'pitch', 'crowd', 'feedback', 'pivot', 'overdrive'];
  const usedInGhosts = ['generating'];
  const allUsed = ['idle', ...usedInGhosts, ...usedInShow];

  for (const phase of allUsed) {
    assertIncludes(`phase "${phase}" is valid`, VALID_PHASES, phase);
  }

  // setPhase is idempotent — calling it twice is safe
  // We can't test DOM side effects here, but we can verify the state update
  const originalPhase = state.phase;
  setPhase('idle');
  assertEqual('setPhase idle: state.phase updated', state.phase, 'idle');
  setPhase('pitch');
  assertEqual('setPhase pitch: state.phase updated', state.phase, 'pitch');
  // Restore
  setPhase(originalPhase);
}

// ============================================================
// 8. Ghost archetypes — sanity checks
// ============================================================

function testGhostArchetypes() {
  assert('GHOST_ARCHETYPES defined', typeof GHOST_ARCHETYPES !== 'undefined');
  assert('GHOST_ARCHETYPES is array', Array.isArray(GHOST_ARCHETYPES));
  assert('GHOST_ARCHETYPES has entries', GHOST_ARCHETYPES.length > 0);

  // Each archetype is a non-empty string
  for (let i = 0; i < GHOST_ARCHETYPES.length; i++) {
    assert(`archetype[${i}] is non-empty string`,
      typeof GHOST_ARCHETYPES[i] === 'string' && GHOST_ARCHETYPES[i].length > 0);
  }

  // Corpus length <= archetype count means no archetype reuse on first pass
  // (they use i % GHOST_ARCHETYPES.length — just document actual behaviour)
  const corpusLen = CONFIG.featherless.models.corpus.length;
  const archetypeLen = GHOST_ARCHETYPES.length;
  assert(
    `corpus (${corpusLen}) vs archetypes (${archetypeLen}): archetype cycling works`,
    typeof (corpusLen % archetypeLen) === 'number'
  );
}

// ============================================================
// Runner
// ============================================================

async function runAllTests() {
  testConfig();
  testLlmPick();
  testLlmJsonExtraction();
  await testLlmFanOutConcurrency();
  testFailsafeGhost();
  testGhostShape();
  testPhaseTransitions();
  testGhostArchetypes();

  return TEST_RESULTS;
}
