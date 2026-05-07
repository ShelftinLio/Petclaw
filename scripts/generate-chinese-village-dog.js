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
  ink: '#15120f',
  dark: '#5a351e',
  furDark: '#8f5a2f',
  fur: '#c98543',
  furLight: '#f0b463',
  muzzle: '#ffe0ad',
  chest: '#fff2cf',
  blush: '#f39a8f',
  eye: '#16120f',
  collar: '#d73535',
  tag: '#ffd55c',
  tongue: '#ff7f8d',
  tear: '#77d7ff',
};

const offlineColors = {
  ink: '#282420',
  dark: '#463d35',
  furDark: '#6e665e',
  fur: '#8a8178',
  furLight: '#aaa198',
  muzzle: '#bbb3a6',
  chest: '#c7c0b2',
  blush: '#827872',
  eye: '#3a3734',
  collar: '#6a5a5a',
  tag: '#8d8474',
  tongue: '#827872',
  tear: '#777f86',
};

const durations = {
  idle: 125,
  happy: 95,
  talking: 90,
  thinking: 145,
  sleepy: 165,
  surprised: 85,
  focused: 120,
  offline: 165,
  sad: 135,
  walking: 80,
};

function rect(parts, x, y, width, height, fill) {
  parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`);
}

function palette(state) {
  return state === 'offline' ? offlineColors : colors;
}

function optionsFor(state, frame) {
  const wag = [-7, -3, 4, 8, 5, -2, -8, -4][frame];
  const opts = {
    state,
    frame,
    p: palette(state),
    bob: [0, -2, -3, -1, 0, 1, 2, 1][frame],
    lean: [0, 0, 1, 1, 0, -1, -1, 0][frame],
    tail: wag,
    ear: frame % 2 === 0 ? 0 : -2,
    eyes: 'open',
    mouth: 'smile',
    paws: 'down',
    side: false,
    step: frame % 4,
  };

  if (state === 'happy') {
    opts.bob = [0, -6, -10, -6, 0, -5, -9, -5][frame];
    opts.lean = frame % 2 === 0 ? -2 : 2;
    opts.tail = wag * 1.6;
    opts.eyes = 'joy';
    opts.mouth = frame % 2 === 0 ? 'tongue' : 'grin';
    opts.paws = 'hop';
  } else if (state === 'talking') {
    opts.mouth = ['small', 'open', 'wide', 'open', 'small', 'open', 'wide', 'open'][frame];
    opts.paws = frame % 2 === 0 ? 'point' : 'down';
  } else if (state === 'thinking') {
    opts.lean = [-4, -3, -2, -1, 1, 2, 1, -1][frame];
    opts.eyes = 'side';
    opts.mouth = 'flat';
    opts.paws = 'chin';
    opts.tail = -3;
  } else if (state === 'sleepy') {
    opts.bob = [4, 5, 5, 6, 5, 4, 5, 6][frame];
    opts.eyes = 'sleep';
    opts.mouth = 'tiny';
    opts.tail = -5;
    opts.ear = 2;
  } else if (state === 'surprised') {
    opts.bob = frame % 2 === 0 ? -7 : 0;
    opts.eyes = 'wide';
    opts.mouth = 'o';
    opts.paws = 'up';
    opts.ear = -8;
    opts.tail = 6;
  } else if (state === 'focused') {
    opts.lean = 3;
    opts.eyes = 'focused';
    opts.mouth = 'flat';
    opts.paws = 'braced';
    opts.tail = [1, 0, -1, 0, 1, 0, -1, 0][frame];
  } else if (state === 'offline') {
    opts.bob = 3;
    opts.eyes = 'dim';
    opts.mouth = 'flat';
    opts.tail = 0;
  } else if (state === 'sad') {
    opts.bob = [4, 5, 4, 3, 4, 5, 4, 3][frame];
    opts.eyes = 'sad';
    opts.mouth = 'sad';
    opts.tail = -7;
    opts.ear = 3;
  } else if (state === 'walking') {
    opts.side = true;
    opts.bob = frame % 2 === 0 ? 0 : -3;
    opts.lean = frame % 2 === 0 ? 3 : -1;
    opts.eyes = 'side';
    opts.mouth = 'smile';
    opts.tail = [7, 4, 0, -4, -7, -4, 0, 4][frame];
  }

  return opts;
}

function drawTail(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const t = Math.round(opts.tail);
  const lean = opts.lean;
  if (opts.side) {
    rect(parts, 42 + lean + t, 112 + y, 18, 12, p.ink);
    rect(parts, 32 + lean + t, 98 + y, 20, 16, p.fur);
    rect(parts, 38 + lean + t, 86 + y, 22, 14, p.furLight);
    rect(parts, 56 + lean + t, 90 + y, 10, 10, p.ink);
    return;
  }
  rect(parts, 34 + lean + t, 112 + y, 18, 12, p.ink);
  rect(parts, 24 + lean + t, 96 + y, 22, 16, p.fur);
  rect(parts, 30 + lean + t, 82 + y, 24, 16, p.furLight);
  rect(parts, 50 + lean + t, 86 + y, 10, 10, p.ink);
}

function drawFeet(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  if (opts.side) {
    const back = opts.step === 0 ? -8 : opts.step === 2 ? 5 : 0;
    const front = opts.step === 2 ? 9 : opts.step === 0 ? -3 : 3;
    rect(parts, 66 + lean + back, 176 + y, 26, 12, p.ink);
    rect(parts, 108 + lean + front, 176 + y, 28, 12, p.ink);
    rect(parts, 72 + lean + back, 172 + y, 13, 5, p.muzzle);
    rect(parts, 116 + lean + front, 172 + y, 13, 5, p.muzzle);
    return;
  }
  const hop = opts.paws === 'hop' && opts.frame % 2 === 1 ? -4 : 0;
  rect(parts, 58 + lean, 176 + y + hop, 26, 12, p.ink);
  rect(parts, 108 + lean, 176 + y - hop, 28, 12, p.ink);
  rect(parts, 64 + lean, 172 + y + hop, 13, 5, p.muzzle);
  rect(parts, 116 + lean, 172 + y - hop, 13, 5, p.muzzle);
}

function drawBody(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 54 + lean, 112 + y, 88, 60, p.ink);
  rect(parts, 62 + lean, 106 + y, 76, 62, p.fur);
  rect(parts, 78 + lean, 118 + y, 44, 46, p.chest);
  rect(parts, 70 + lean, 108 + y, 54, 10, p.furLight);
  rect(parts, 74 + lean, 122 + y, 10, 20, p.furDark);
  rect(parts, 120 + lean, 126 + y, 10, 18, p.furDark);
  rect(parts, 70 + lean, 112 + y, 58, 8, p.collar);
  rect(parts, 96 + lean, 118 + y, 9, 9, p.tag);
}

function drawPaws(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  if (opts.paws === 'hop' || opts.paws === 'up') {
    rect(parts, 40 + lean, 118 + y, 20, 14, p.ink);
    rect(parts, 132 + lean, 118 + y, 20, 14, p.ink);
    rect(parts, 34 + lean, 108 + y, 14, 14, p.furLight);
    rect(parts, 148 + lean, 108 + y, 14, 14, p.furLight);
  } else if (opts.paws === 'point') {
    rect(parts, 44 + lean, 136 + y, 18, 12, p.ink);
    rect(parts, 130 + lean, 126 + y, 26, 10, p.ink);
    rect(parts, 154 + lean, 122 + y, 11, 11, p.furLight);
  } else if (opts.paws === 'chin') {
    rect(parts, 44 + lean, 138 + y, 18, 12, p.ink);
    rect(parts, 126 + lean, 120 + y, 18, 18, p.ink);
    rect(parts, 136 + lean, 112 + y, 10, 10, p.furLight);
  } else if (opts.paws === 'braced') {
    rect(parts, 44 + lean, 144 + y, 30, 12, p.ink);
    rect(parts, 122 + lean, 144 + y, 30, 12, p.ink);
    rect(parts, 70 + lean, 141 + y, 10, 10, p.furLight);
    rect(parts, 118 + lean, 141 + y, 10, 10, p.furLight);
  } else {
    rect(parts, 44 + lean, 134 + y, 18, 18, p.ink);
    rect(parts, 132 + lean, 134 + y, 18, 18, p.ink);
    rect(parts, 48 + lean, 144 + y, 11, 11, p.furLight);
    rect(parts, 136 + lean, 144 + y, 11, 11, p.furLight);
  }
}

function drawEar(parts, x, y, flip, opts) {
  const p = opts.p;
  const s = flip ? -1 : 1;
  rect(parts, x, y + 24, 24, 18, p.ink);
  rect(parts, x + s * 4, y + 12, 22, 18, p.furDark);
  rect(parts, x + s * 8, y, 18, 16, p.fur);
  rect(parts, x + s * 9, y + 18, 10, 16, p.muzzle);
}

function drawHead(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  drawEar(parts, 52 + lean, 50 + y + opts.ear, false, opts);
  drawEar(parts, 140 + lean, 50 + y + opts.ear, true, opts);
  rect(parts, 58 + lean, 74 + y, 80, 58, p.ink);
  rect(parts, 66 + lean, 68 + y, 68, 58, p.fur);
  rect(parts, 72 + lean, 82 + y, 56, 46, p.furLight);
  rect(parts, 82 + lean, 106 + y, 36, 24, p.muzzle);
  rect(parts, 94 + lean, 105 + y, 12, 8, p.ink);
  rect(parts, 62 + lean, 74 + y, 18, 24, p.furDark);
  rect(parts, 118 + lean, 78 + y, 14, 22, p.furDark);
  rect(parts, 68 + lean, 116 + y, 8, 7, p.blush);
  rect(parts, 126 + lean, 116 + y, 8, 7, p.blush);
}

function drawEyes(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const eyeY = 92 + y;
  if (opts.eyes === 'sleep') {
    rect(parts, 76 + lean, eyeY + 8, 18, 4, p.eye);
    rect(parts, 110 + lean, eyeY + 8, 18, 4, p.eye);
    return;
  }
  if (opts.eyes === 'joy') {
    rect(parts, 74 + lean, eyeY + 8, 20, 5, p.eye);
    rect(parts, 110 + lean, eyeY + 8, 20, 5, p.eye);
    rect(parts, 80 + lean, eyeY + 13, 8, 4, p.eye);
    rect(parts, 116 + lean, eyeY + 13, 8, 4, p.eye);
    return;
  }
  if (opts.eyes === 'wide') {
    rect(parts, 74 + lean, eyeY, 20, 22, p.eye);
    rect(parts, 110 + lean, eyeY, 20, 22, p.eye);
    rect(parts, 80 + lean, eyeY + 5, 8, 10, p.chest);
    rect(parts, 116 + lean, eyeY + 5, 8, 10, p.chest);
    return;
  }
  if (opts.eyes === 'focused') {
    rect(parts, 74 + lean, eyeY + 4, 22, 6, p.eye);
    rect(parts, 108 + lean, eyeY + 4, 22, 6, p.eye);
    rect(parts, 82 + lean, eyeY + 10, 8, 8, p.eye);
    rect(parts, 116 + lean, eyeY + 10, 8, 8, p.eye);
    return;
  }
  if (opts.eyes === 'side') {
    rect(parts, 78 + lean, eyeY + 4, 12, 14, p.eye);
    rect(parts, 114 + lean, eyeY + 4, 12, 14, p.eye);
    return;
  }
  if (opts.eyes === 'sad' || opts.eyes === 'dim') {
    rect(parts, 76 + lean, eyeY + 9, 16, 4, p.eye);
    rect(parts, 112 + lean, eyeY + 9, 16, 4, p.eye);
    if (opts.eyes === 'sad') rect(parts, 92 + lean, eyeY + 14, 5, 10, p.tear);
    return;
  }
  rect(parts, 76 + lean, eyeY + 4, 16, 16, p.eye);
  rect(parts, 112 + lean, eyeY + 4, 16, 16, p.eye);
  rect(parts, 80 + lean, eyeY + 5, 4, 4, '#ffffff');
  rect(parts, 116 + lean, eyeY + 5, 4, 4, '#ffffff');
}

function drawMouth(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  if (opts.mouth === 'grin') {
    rect(parts, 86 + lean, 122 + y, 30, 10, p.eye);
    rect(parts, 94 + lean, 122 + y, 14, 4, p.chest);
    rect(parts, 98 + lean, 128 + y, 8, 5, p.tongue);
  } else if (opts.mouth === 'tongue') {
    rect(parts, 90 + lean, 122 + y, 22, 10, p.eye);
    rect(parts, 98 + lean, 128 + y, 8, 10, p.tongue);
  } else if (opts.mouth === 'open') {
    rect(parts, 94 + lean, 122 + y, 14, 10, p.eye);
    rect(parts, 98 + lean, 128 + y, 6, 4, p.tongue);
  } else if (opts.mouth === 'wide') {
    rect(parts, 90 + lean, 122 + y, 22, 10, p.eye);
  } else if (opts.mouth === 'o') {
    rect(parts, 96 + lean, 121 + y, 12, 14, p.eye);
    rect(parts, 100 + lean, 126 + y, 4, 5, p.tongue);
  } else if (opts.mouth === 'sad') {
    rect(parts, 88 + lean, 130 + y, 8, 4, p.eye);
    rect(parts, 96 + lean, 126 + y, 16, 4, p.eye);
    rect(parts, 112 + lean, 130 + y, 8, 4, p.eye);
  } else if (opts.mouth === 'flat') {
    rect(parts, 88 + lean, 126 + y, 28, 4, p.eye);
  } else if (opts.mouth === 'small') {
    rect(parts, 96 + lean, 124 + y, 12, 4, p.eye);
  } else {
    rect(parts, 90 + lean, 124 + y, 9, 4, p.eye);
    rect(parts, 104 + lean, 124 + y, 9, 4, p.eye);
  }
}

function drawFrame(state, frame) {
  const opts = optionsFor(state, frame);
  const parts = [];
  drawTail(parts, opts);
  drawFeet(parts, opts);
  drawBody(parts, opts);
  drawPaws(parts, opts);
  drawHead(parts, opts);
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
    id: 'chinese-village-dog',
    name: 'Chinese Village Dog',
    description: 'A sunny pixel Chinese village dog with tan fur, perked ears, a curled tail, and a tiny red collar.',
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

const outDir = path.join(__dirname, '..', 'assets', 'pets', 'chinese-village-dog');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'spritesheet.svg'), buildSvg());
fs.writeFileSync(path.join(outDir, 'pet.json'), `${JSON.stringify(buildManifest(), null, 2)}\n`);
console.log(`Generated ${path.relative(process.cwd(), outDir)}`);
