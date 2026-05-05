const path = require('path');

const COW_CAT_ID = 'cow-cat';
const VALID_RENDERERS = ['dom-cow-cat', 'image', 'spritesheet', 'frames'];
const VALID_SOURCES = ['built-in', 'local-image', 'imagegen', 'package'];
const HATCH_STATES = [
  ['idle', 'resting breathing loop, subtle blink, stable centered pose'],
  ['happy', 'cheerful bounce, smiling eyes, upbeat body pose'],
  ['talking', 'mouth or face movement suitable for speaking loop'],
  ['thinking', 'focused head tilt or lean, contemplative eyes'],
  ['sleepy', 'drowsy slow blink, relaxed low-energy pose'],
  ['surprised', 'startled upright pose, wide eyes'],
  ['focused', 'review-like concentrated pose, tiny lean forward'],
  ['offline', 'quiet dim low-energy idle pose'],
  ['sad', 'small disappointed pose, lowered expression'],
  ['walking', 'sideways walking loop, alternating paws, body moving with a gentle step rhythm'],
];

function normalizeAppearanceConfig(appearance = {}) {
  const customPets = Array.isArray(appearance.customPets)
    ? appearance.customPets.filter(pet => pet && typeof pet.id === 'string')
    : [];

  return {
    mode: typeof appearance.mode === 'string' ? appearance.mode : 'cow-cat',
    activePetId: typeof appearance.activePetId === 'string' ? appearance.activePetId : COW_CAT_ID,
    customPets,
  };
}

function createBuiltInCowCatManifest() {
  return {
    id: COW_CAT_ID,
    name: 'Cow Cat',
    description: 'A tiny pixel cow-cat companion for focused desktop work.',
    source: 'built-in',
    renderer: 'spritesheet',
    version: 1,
    spritesheet: 'spritesheet.svg',
    cell: { width: 192, height: 208 },
    layout: { columns: 8, rows: 10 },
    motion: { roam: true },
    states: {
      idle: { row: 0, frames: 8, duration: 140 },
      happy: { row: 1, frames: 8, duration: 120 },
      talking: { row: 2, frames: 8, duration: 100 },
      thinking: { row: 3, frames: 8, duration: 160 },
      sleepy: { row: 4, frames: 8, duration: 180 },
      surprised: { row: 5, frames: 8, duration: 110 },
      focused: { row: 6, frames: 8, duration: 140 },
      offline: { row: 7, frames: 8, duration: 180 },
      sad: { row: 8, frames: 8, duration: 160 },
      walking: { row: 9, frames: 8, duration: 90 },
    },
  };
}

function createImagePetManifest({ id, name, image = 'generated.png', source = 'local-image' }) {
  const baseState = { image, duration: 180 };
  return {
    id,
    name: name || 'Custom Pet',
    description: 'A custom pixel-style desktop pet.',
    source,
    renderer: 'image',
    version: 1,
    states: {
      idle: baseState,
      happy: { image, duration: 150 },
      talking: { image, duration: 120 },
      thinking: { image, duration: 220 },
      sleepy: { image, duration: 260 },
      sad: { image, duration: 220 },
      surprised: { image, duration: 140 },
      focused: { image, duration: 180 },
      offline: { image, duration: 260 },
    },
  };
}

function createImagegenPetRequest({
  id,
  name,
  description,
  referenceImage,
  createdAt,
} = {}) {
  const safeId = id || createPetId();
  const petName = name || 'Generated Pet';
  const subject = description || 'a friendly custom desktop pet';
  const record = createCustomPetRecord({
    id: safeId,
    name: petName,
    source: 'imagegen',
    renderer: 'spritesheet',
    createdAt,
  });
  const manifest = {
    id: safeId,
    name: petName,
    description: `Generated with Codex $imagegen from: ${subject}`,
    source: 'imagegen',
    renderer: 'spritesheet',
    version: 1,
    spritesheet: 'spritesheet.webp',
    cell: { width: 192, height: 208 },
    layout: { columns: 8, rows: 10 },
    motion: { roam: false },
    states: {
      idle: { row: 0, frames: 8, duration: 140 },
      happy: { row: 1, frames: 8, duration: 120 },
      talking: { row: 2, frames: 8, duration: 100 },
      thinking: { row: 3, frames: 8, duration: 160 },
      sleepy: { row: 4, frames: 8, duration: 180 },
      surprised: { row: 5, frames: 8, duration: 110 },
      focused: { row: 6, frames: 8, duration: 140 },
      offline: { row: 7, frames: 8, duration: 180 },
      sad: { row: 8, frames: 8, duration: 160 },
      walking: { row: 9, frames: 8, duration: 90 },
    },
  };
  const referenceLine = referenceImage
    ? `Reference image: ${referenceImage}. Use it as the character reference while simplifying the design.`
    : 'Reference image: none. Generate from the written description only.';
  const jobs = createHatchPetJobs({
    petName,
    description: subject,
    referenceImage,
  });
  const prompt = [
    'Use $imagegen to create a Codex/Hatch-style desktop pet spritesheet.',
    '',
    `Pet name: ${petName}`,
    `Primary request: ${subject}`,
    referenceLine,
    '',
    'Asset type: transparent pixel-art desktop pet spritesheet',
    'Style: compact chibi pixel art, chunky readable silhouette, thick dark 1-2 px outline, flat cel shading, vertical i-like glowing eyes, tiny ears/paws/tail where appropriate.',
    'Character framing: create a full-body virtual pet in every frame. If the reference is a headshot, avatar, or face-only image, infer the full body, outfit, arms, hands, legs, and feet from the identity and description.',
    'Spritesheet: 8 columns x 10 rows, each cell 192x208 px, final file named spritesheet.webp.',
    `Rows in order: ${HATCH_STATES.map(([state]) => state).join(', ')}.`,
    'Background workflow: prefer true transparency. If the image tool cannot output transparency, use a perfectly flat solid #00ff00 chroma-key background for local removal.',
    'Constraints: no text, no watermark, no scenery, no shadows, no gradients, no detached effects, keep each frame centered with consistent scale.',
  ].join('\n');
  const readme = [
    `# ${petName} Imagegen Request`,
    '',
    'This folder is a Petclaw custom pet package scaffold.',
    '',
    '1. Open `imagegen-jobs.json` and run each job through Codex `$imagegen`.',
    '2. First generate `base-reference.png`; use it as the canonical reference for every row job.',
    '3. Generate each 8-frame row strip into `rows/<state>.png`.',
    '4. Assemble the rows into `spritesheet.webp` using the same 8x10, 192x208-cell layout.',
    '5. Keep `pet.json` next to `spritesheet.webp`.',
    '6. Import this folder from the Petclaw appearance panel.',
    '',
    'Expected output:',
    '- `pet.json`',
    '- `spritesheet.webp`',
    referenceImage ? `- \`${referenceImage}\` as the optional reference image` : '',
  ].filter(Boolean).join('\n');

  return { record, manifest, prompt, readme, jobs };
}

function createHatchPetJobs({ petName, description, referenceImage } = {}) {
  const safeName = petName || 'Generated Pet';
  const subject = description || 'a friendly custom desktop pet';
  const baseInputs = referenceImage ? [referenceImage] : [];
  const basePrompt = [
    `Create the canonical base reference for ${safeName}, a Codex digital pet.`,
    `Subject: ${subject}.`,
    'Style: small pixel-art-adjacent mascot, compact chibi proportions, chunky readable silhouette, thick dark 1-2 px outline, visible stepped/pixel edges, limited palette, flat cel shading, simple expressive face, tiny limbs.',
    'Output: one centered full-body character reference on transparent background. If the source is a headshot, avatar, or face-only image, infer a complete body with outfit, arms, hands, legs, and feet. If transparency is unavailable, use perfectly flat #00ff00 chroma-key background for cleanup.',
    'Avoid: text, watermark, scenery, shadows, gradients, glow, realistic fur, painterly rendering, 3D, detached effects, floor marks.',
  ].join('\n');

  const jobs = [{
    id: 'base',
    kind: 'base',
    output: 'base-reference.png',
    inputs: baseInputs,
    prompt: basePrompt,
  }];

  for (let row = 0; row < HATCH_STATES.length; row++) {
    const [state, guidance] = HATCH_STATES[row];
    jobs.push({
      id: `row-${state}`,
      kind: 'row',
      state,
      row,
      output: `rows/${state}.png`,
      inputs: ['base-reference.png', ...baseInputs],
      prompt: [
        `Create an 8-frame horizontal strip for the "${state}" animation of ${safeName}.`,
        `State guidance: ${guidance}.`,
        'Use the attached base-reference.png as the canonical identity. Preserve shape, palette, outline thickness, face design, and scale.',
        'Each frame is one 192x208 cell; total strip is 1536x208. Keep each pet centered inside its cell with the full body visible from head to feet.',
        'Use transparent background in every cell. If transparency is unavailable, use perfectly flat #00ff00 chroma-key background in every cell for cleanup. No grid, frame numbers, text, shadows, floor, motion arcs, detached sparkles, or loose effects.',
        'The animation should read through pose and expression changes only.',
      ].join('\n'),
    });
  }

  return jobs;
}

function validatePetManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, error: 'pet.json must contain an object' };
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    return { ok: false, error: 'pet.json name is required' };
  }

  if (!VALID_RENDERERS.includes(manifest.renderer)) {
    return {
      ok: false,
      error: `pet.json renderer must be one of: ${VALID_RENDERERS.join(', ')}`,
    };
  }

  if (manifest.source && !VALID_SOURCES.includes(manifest.source)) {
    return {
      ok: false,
      error: `pet.json source must be one of: ${VALID_SOURCES.join(', ')}`,
    };
  }

  if (!manifest.states || typeof manifest.states !== 'object' || !manifest.states.idle) {
    return { ok: false, error: 'pet.json states.idle is required' };
  }

  return { ok: true };
}

function createCustomPetRecord({ id, name, source, renderer, createdAt }) {
  const safeId = id || createPetId();
  const assetDir = path.posix.join('assets', 'pets', 'custom', safeId);

  return {
    id: safeId,
    name: name || 'Custom Pet',
    source: source || 'local-image',
    renderer: renderer || 'image',
    assetDir,
    manifestPath: path.posix.join(assetDir, 'pet.json'),
    createdAt: createdAt || new Date().toISOString(),
  };
}

function createPetId(date = new Date()) {
  const stamp = date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '-');
  return `custom-${stamp}`;
}

function upsertCustomPet(appearance, record) {
  const normalized = normalizeAppearanceConfig(appearance);
  const customPets = normalized.customPets.filter(pet => pet.id !== record.id);
  customPets.push(record);
  return { ...normalized, customPets };
}

function removeCustomPet(appearance, petId) {
  const normalized = normalizeAppearanceConfig(appearance);
  if (!petId || petId === COW_CAT_ID) return normalized;
  const customPets = normalized.customPets.filter(pet => pet.id !== petId);
  if (normalized.activePetId === petId) {
    return {
      ...normalized,
      mode: 'cow-cat',
      activePetId: COW_CAT_ID,
      customPets,
    };
  }
  return { ...normalized, customPets };
}

function setActivePet(appearance, petId) {
  const normalized = normalizeAppearanceConfig(appearance);
  if (petId === COW_CAT_ID) {
    return { ...normalized, mode: 'cow-cat', activePetId: COW_CAT_ID };
  }
  return { ...normalized, mode: 'custom', activePetId: petId };
}

function inferRendererFromFiles(files = []) {
  const names = files.map(file => String(file).toLowerCase());
  if (names.includes('spritesheet.webp')) return 'spritesheet';
  if (names.includes('generated.png') || names.includes('generated.webp')) return 'image';
  if (names.some(name => /(^|[/\\])(idle|happy|talking|thinking)\.(png|webp|jpg|jpeg)$/.test(name))) {
    return 'frames';
  }
  return null;
}

module.exports = {
  COW_CAT_ID,
  VALID_RENDERERS,
  VALID_SOURCES,
  normalizeAppearanceConfig,
  createBuiltInCowCatManifest,
  createImagePetManifest,
  createImagegenPetRequest,
  createHatchPetJobs,
  validatePetManifest,
  createCustomPetRecord,
  createPetId,
  upsertCustomPet,
  removeCustomPet,
  setActivePet,
  inferRendererFromFiles,
};
