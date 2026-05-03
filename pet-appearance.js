const path = require('path');

const COW_CAT_ID = 'cow-cat';
const VALID_RENDERERS = ['dom-cow-cat', 'image', 'spritesheet', 'frames'];
const VALID_SOURCES = ['built-in', 'local-image', 'imagegen', 'package'];

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
    renderer: 'dom-cow-cat',
    version: 1,
    states: {
      idle: { duration: 180 },
      happy: { duration: 150 },
      talking: { duration: 120 },
      thinking: { duration: 220 },
      sleepy: { duration: 260 },
      sad: { duration: 220 },
      surprised: { duration: 140 },
      focused: { duration: 180 },
      offline: { duration: 260 },
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
  validatePetManifest,
  createCustomPetRecord,
  createPetId,
  upsertCustomPet,
  setActivePet,
  inferRendererFromFiles,
};
