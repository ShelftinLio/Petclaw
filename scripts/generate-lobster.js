const fs = require('fs');
const path = require('path');

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const COLUMNS = 8;
const ROWS = [
  'idle',
  'happy',
  'talking',
  'thinking',
  'sleepy',
  'surprised',
  'focused',
  'offline',
  'sad',
  'walking',
];

const colors = {
  ink: '#17110f',
  deep: '#84191d',
  shellDark: '#b82020',
  shell: '#e63d2e',
  shellLight: '#ff6b4a',
  belly: '#ffd0a0',
  blush: '#ff9a8e',
  eye: '#111111',
  shine: '#fff4df',
  tear: '#6bd7ff',
};

const offlineColors = {
  ink: '#252220',
  deep: '#413b38',
  shellDark: '#665f5b',
  shell: '#85807b',
  shellLight: '#aaa39b',
  belly: '#bdb5aa',
  blush: '#77706a',
  eye: '#3b3835',
  shine: '#d0cbc2',
  tear: '#858d94',
};

const durations = {
  idle: 118,
  happy: 88,
  talking: 92,
  thinking: 138,
  sleepy: 168,
  surprised: 78,
  focused: 118,
  offline: 170,
  sad: 138,
  walking: 76,
};

function rect(parts, x, y, width, height, fill) {
  parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`);
}

function palette(state) {
  return state === 'offline' ? offlineColors : colors;
}

function optionsFor(state, frame) {
  const wave = [-4, -2, 1, 4, 3, 0, -3, -5][frame];
  const opts = {
    state,
    frame,
    p: palette(state),
    bob: [0, -2, -3, -1, 0, 1, 2, 1][frame],
    lean: [0, -1, 1, 1, 0, -1, -1, 0][frame],
    claw: wave,
    antenna: frame % 2 === 0 ? 0 : -2,
    eyes: 'open',
    mouth: 'smile',
    arms: 'idle',
    step: frame % 4,
  };

  if (state === 'happy') {
    opts.bob = [0, -5, -8, -5, 0, -6, -9, -4][frame];
    opts.lean = frame % 2 === 0 ? -1 : 1;
    opts.claw = wave * 1.4;
    opts.eyes = 'joy';
    opts.mouth = frame % 2 === 0 ? 'smile' : 'open';
    opts.arms = 'up';
  } else if (state === 'talking') {
    opts.mouth = ['tiny', 'open', 'open', 'tiny', 'open', 'tiny', 'open', 'tiny'][frame];
    opts.arms = frame % 2 === 0 ? 'point' : 'idle';
  } else if (state === 'thinking') {
    opts.lean = [-3, -2, -1, 0, 1, 2, 1, 0][frame];
    opts.eyes = 'side';
    opts.mouth = 'tiny';
    opts.arms = 'chin';
    opts.claw = -2;
  } else if (state === 'sleepy') {
    opts.bob = [3, 4, 5, 5, 4, 3, 4, 5][frame];
    opts.eyes = 'sleep';
    opts.mouth = 'tiny';
    opts.claw = -3;
    opts.antenna = 2;
  } else if (state === 'surprised') {
    opts.bob = frame % 2 === 0 ? -6 : 0;
    opts.eyes = 'wide';
    opts.mouth = 'o';
    opts.arms = 'up';
    opts.claw = 6;
    opts.antenna = -6;
  } else if (state === 'focused') {
    opts.lean = 3;
    opts.eyes = 'focused';
    opts.mouth = 'flat';
    opts.arms = 'braced';
    opts.claw = [1, 0, -1, 0, 1, 0, -1, 0][frame];
  } else if (state === 'offline') {
    opts.bob = 3;
    opts.eyes = 'dim';
    opts.mouth = 'flat';
    opts.claw = 0;
  } else if (state === 'sad') {
    opts.bob = [3, 4, 4, 3, 3, 4, 4, 3][frame];
    opts.eyes = 'sad';
    opts.mouth = 'sad';
    opts.claw = -5;
    opts.antenna = 2;
  } else if (state === 'walking') {
    opts.bob = frame % 2 === 0 ? 0 : -3;
    opts.lean = frame % 2 === 0 ? 3 : -2;
    opts.eyes = 'open';
    opts.mouth = 'smile';
    opts.claw = [5, 2, -1, -5, -2, 1, 5, 2][frame];
  }

  return opts;
}

function drawAntennae(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const wiggle = opts.antenna;
  rect(parts, 60 + lean + wiggle, 60 + y, 20, 6, p.ink);
  rect(parts, 112 + lean - wiggle, 60 + y, 20, 6, p.ink);
  rect(parts, 56 + lean + wiggle, 56 + y, 12, 5, p.shellLight);
  rect(parts, 124 + lean - wiggle, 56 + y, 12, 5, p.shellLight);
}

function drawEyeStalks(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 78 + lean, 70 + y, 8, 20, p.ink);
  rect(parts, 106 + lean, 70 + y, 8, 20, p.ink);
  rect(parts, 80 + lean, 72 + y, 4, 18, p.shellDark);
  rect(parts, 108 + lean, 72 + y, 4, 18, p.shellDark);
}

function drawThinkingCue(parts, opts) {
  if (opts.state !== 'thinking') return;
  const p = opts.p;
  const drift = [0, 1, 2, 1, 0, -1, 0, 1][opts.frame];

  rect(parts, 136 + drift, 38, 22, 6, p.ink);
  rect(parts, 152 + drift, 44, 6, 13, p.ink);
  rect(parts, 144 + drift, 56, 12, 6, p.ink);
  rect(parts, 144 + drift, 66, 7, 7, p.ink);
  rect(parts, 140 + drift, 40, 12, 3, p.shine);
  rect(parts, 153 + drift, 47, 3, 8, p.shine);
  rect(parts, 146 + drift, 57, 8, 3, p.shine);
  rect(parts, 146 + drift, 67, 5, 4, p.shine);
}

function drawLegs(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const lift = opts.step % 2 === 1 ? -2 : 0;
  for (let i = 0; i < 3; i += 1) {
    const row = 148 + i * 9 + y;
    const walk = opts.state === 'walking' && i === opts.step % 3 ? 3 : 0;
    rect(parts, 61 - i * 4 + lean - walk, row + (i % 2 === 0 ? lift : 0), 16, 6, p.ink);
    rect(parts, 50 - i * 2 + lean - walk, row + 5 + (i % 2 === 0 ? lift : 0), 15, 7, p.shellDark);
    rect(parts, 115 + i * 4 + lean + walk, row + (i % 2 === 1 ? lift : 0), 16, 6, p.ink);
    rect(parts, 127 + i * 2 + lean + walk, row + 5 + (i % 2 === 1 ? lift : 0), 15, 7, p.shellDark);
  }
}

function drawTail(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 72 + lean, 154 + y, 48, 16, p.ink);
  rect(parts, 78 + lean, 152 + y, 36, 15, p.shellDark);
  rect(parts, 82 + lean, 165 + y, 28, 12, p.ink);
  rect(parts, 86 + lean, 164 + y, 20, 11, p.shell);
  rect(parts, 72 + lean, 176 + y, 16, 9, p.ink);
  rect(parts, 104 + lean, 176 + y, 16, 9, p.ink);
  rect(parts, 78 + lean, 174 + y, 9, 7, p.shellLight);
  rect(parts, 105 + lean, 174 + y, 9, 7, p.shellLight);
}

function drawClaws(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const raise = opts.arms === 'up' ? -13 : opts.arms === 'chin' ? -6 : 0;
  const brace = opts.arms === 'braced' ? 6 : 0;
  const wave = Math.round(opts.claw);

  rect(parts, 46 + lean - wave, 116 + y + brace, 22, 8, p.ink);
  rect(parts, 36 + lean - wave, 106 + y + raise + brace, 23, 16, p.shellDark);
  rect(parts, 30 + lean - wave, 96 + y + raise + brace, 24, 18, p.ink);
  rect(parts, 34 + lean - wave, 96 + y + raise + brace, 18, 14, p.shell);
  rect(parts, 28 + lean - wave, 88 + y + raise + brace, 15, 12, p.ink);
  rect(parts, 31 + lean - wave, 90 + y + raise + brace, 10, 8, p.shellLight);
  rect(parts, 47 + lean - wave, 90 + y + raise + brace, 15, 12, p.ink);
  rect(parts, 49 + lean - wave, 92 + y + raise + brace, 10, 8, p.shellLight);

  rect(parts, 124 + lean + wave, 116 + y + brace, 22, 8, p.ink);
  rect(parts, 133 + lean + wave, 106 + y + raise + brace, 23, 16, p.shellDark);
  rect(parts, 138 + lean + wave, 96 + y + raise + brace, 24, 18, p.ink);
  rect(parts, 140 + lean + wave, 96 + y + raise + brace, 18, 14, p.shell);
  rect(parts, 137 + lean + wave, 90 + y + raise + brace, 15, 12, p.ink);
  rect(parts, 140 + lean + wave, 92 + y + raise + brace, 10, 8, p.shellLight);
  rect(parts, 153 + lean + wave, 88 + y + raise + brace, 15, 12, p.ink);
  rect(parts, 155 + lean + wave, 90 + y + raise + brace, 10, 8, p.shellLight);

  if (opts.arms === 'point') {
    rect(parts, 124 + lean, 114 + y, 26, 7, p.ink);
    rect(parts, 146 + lean, 108 + y, 11, 11, p.shellLight);
  }
}

function drawBody(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 68 + lean, 86 + y, 56, 8, p.ink);
  rect(parts, 58 + lean, 94 + y, 76, 56, p.ink);
  rect(parts, 66 + lean, 150 + y, 60, 11, p.ink);
  rect(parts, 72 + lean, 84 + y, 48, 9, p.shellLight);
  rect(parts, 64 + lean, 92 + y, 64, 58, p.shell);
  rect(parts, 72 + lean, 101 + y, 48, 47, p.shellLight);
  rect(parts, 82 + lean, 132 + y, 28, 18, p.belly);
  rect(parts, 68 + lean, 106 + y, 7, 32, p.shellDark);
  rect(parts, 117 + lean, 106 + y, 7, 32, p.shellDark);
  rect(parts, 84 + lean, 141 + y, 9, 3, p.shellDark);
  rect(parts, 101 + lean, 141 + y, 9, 3, p.shellDark);
}

function drawThinkingHands(parts, opts) {
  if (opts.arms !== 'chin') return;
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;

  rect(parts, 114 + lean, 122 + y, 22, 7, p.ink);
  rect(parts, 123 + lean, 114 + y, 14, 14, p.ink);
  rect(parts, 126 + lean, 116 + y, 9, 10, p.shellLight);
  rect(parts, 118 + lean, 125 + y, 10, 4, p.shellDark);
}

function drawEyes(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const eyeY = 62 + y;
  rect(parts, 70 + lean, eyeY, 24, 22, p.ink);
  rect(parts, 100 + lean, eyeY, 24, 22, p.ink);

  if (opts.eyes === 'joy' || opts.eyes === 'sleep') {
    rect(parts, 74 + lean, eyeY + 13, 16, 5, p.eye);
    rect(parts, 104 + lean, eyeY + 13, 16, 5, p.eye);
    return;
  }
  if (opts.eyes === 'wide') {
    rect(parts, 73 + lean, eyeY + 3, 18, 17, p.shine);
    rect(parts, 103 + lean, eyeY + 3, 18, 17, p.shine);
    rect(parts, 79 + lean, eyeY + 8, 7, 9, p.eye);
    rect(parts, 109 + lean, eyeY + 8, 7, 9, p.eye);
    return;
  }
  if (opts.eyes === 'focused') {
    rect(parts, 74 + lean, eyeY + 11, 16, 5, p.eye);
    rect(parts, 104 + lean, eyeY + 11, 16, 5, p.eye);
    return;
  }
  if (opts.eyes === 'side') {
    rect(parts, 80 + lean, eyeY + 7, 8, 10, p.eye);
    rect(parts, 110 + lean, eyeY + 7, 8, 10, p.eye);
    return;
  }
  if (opts.eyes === 'sad' || opts.eyes === 'dim') {
    rect(parts, 74 + lean, eyeY + 14, 16, 4, p.eye);
    rect(parts, 104 + lean, eyeY + 14, 16, 4, p.eye);
    if (opts.eyes === 'sad') rect(parts, 92 + lean, eyeY + 20, 5, 9, p.tear);
    return;
  }
  rect(parts, 74 + lean, eyeY + 4, 16, 15, p.shine);
  rect(parts, 104 + lean, eyeY + 4, 16, 15, p.shine);
  rect(parts, 80 + lean, eyeY + 9, 7, 8, p.eye);
  rect(parts, 110 + lean, eyeY + 9, 7, 8, p.eye);
}

function drawMouth(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 73 + lean, 116 + y, 7, 6, p.blush);
  rect(parts, 114 + lean, 116 + y, 7, 6, p.blush);
  if (opts.mouth === 'open') {
    rect(parts, 92 + lean, 119 + y, 10, 8, p.eye);
    rect(parts, 95 + lean, 124 + y, 4, 3, p.blush);
  } else if (opts.mouth === 'o') {
    rect(parts, 92 + lean, 118 + y, 10, 10, p.eye);
    rect(parts, 95 + lean, 121 + y, 4, 4, p.blush);
  } else if (opts.mouth === 'sad') {
    rect(parts, 88 + lean, 126 + y, 6, 3, p.eye);
    rect(parts, 94 + lean, 123 + y, 8, 3, p.eye);
    rect(parts, 102 + lean, 126 + y, 6, 3, p.eye);
  } else if (opts.mouth === 'flat') {
    rect(parts, 89 + lean, 123 + y, 16, 3, p.eye);
  } else if (opts.mouth === 'tiny') {
    rect(parts, 93 + lean, 122 + y, 8, 3, p.eye);
  } else {
    rect(parts, 88 + lean, 120 + y, 6, 3, p.eye);
    rect(parts, 94 + lean, 123 + y, 8, 3, p.eye);
    rect(parts, 102 + lean, 120 + y, 6, 3, p.eye);
  }
}

function drawFrame(state, frame) {
  const opts = optionsFor(state, frame);
  const parts = [];
  drawAntennae(parts, opts);
  drawThinkingCue(parts, opts);
  drawEyeStalks(parts, opts);
  drawLegs(parts, opts);
  drawTail(parts, opts);
  drawClaws(parts, opts);
  drawBody(parts, opts);
  drawThinkingHands(parts, opts);
  drawEyes(parts, opts);
  drawMouth(parts, opts);
  return parts.join('');
}

function buildSvg() {
  const defs = [];
  const groups = [];
  for (let row = 0; row < ROWS.length; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const id = `clip-${row}-${column}`;
      const x = column * CELL_WIDTH;
      const y = row * CELL_HEIGHT;
      defs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${CELL_WIDTH}" height="${CELL_HEIGHT}"/></clipPath>`);
      groups.push(`<g clip-path="url(#${id})"><g transform="translate(${x} ${y})">${drawFrame(ROWS[row], column)}</g></g>`);
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_WIDTH * COLUMNS}" height="${CELL_HEIGHT * ROWS.length}" viewBox="0 0 ${CELL_WIDTH * COLUMNS} ${CELL_HEIGHT * ROWS.length}" shape-rendering="crispEdges">`,
    `<defs>${defs.join('')}</defs>`,
    groups.join('\n'),
    '</svg>',
  ].join('\n');
}

function buildManifest() {
  const states = {};
  for (let row = 0; row < ROWS.length; row += 1) {
    const state = ROWS[row];
    states[state] = { row, frames: 8, duration: durations[state] };
  }
  return {
    id: 'lobster',
    name: 'Lobster',
    description: 'A cheerful chibi pixel lobster with tiny legs, soft round eyes, and little snippy claws.',
    source: 'built-in',
    renderer: 'spritesheet',
    version: 1,
    spritesheet: 'spritesheet.svg',
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    layout: { columns: COLUMNS, rows: ROWS.length },
    motion: { roam: true },
    states,
  };
}

const outDir = path.join(__dirname, '..', 'assets', 'pets', 'lobster');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'spritesheet.svg'), buildSvg());
fs.writeFileSync(path.join(outDir, 'pet.json'), `${JSON.stringify(buildManifest(), null, 2)}\n`);
console.log(`Generated ${path.relative(process.cwd(), outDir)}`);
