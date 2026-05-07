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
  ink: '#151117',
  deep: '#3a273b',
  fur: '#a98abb',
  furLight: '#d6bddc',
  cream: '#fff1dc',
  blush: '#ff9eb3',
  eye: '#ffe36e',
  eyeAlt: '#9dfff3',
  pupil: '#111111',
  collar: '#ff4f88',
  bell: '#ffe066',
  tongue: '#ff718d',
  tear: '#74d9ff',
};

const offlineColors = {
  ink: '#28242a',
  deep: '#1b181d',
  fur: '#77727c',
  furLight: '#9a96a0',
  cream: '#aaa5a1',
  blush: '#77727c',
  eye: '#6e6a72',
  eyeAlt: '#6e6a72',
  pupil: '#1a171c',
  collar: '#55515a',
  bell: '#77727c',
  tongue: '#77727c',
  tear: '#77727c',
};

const durations = {
  idle: 120,
  happy: 92,
  talking: 82,
  thinking: 135,
  sleepy: 165,
  surprised: 78,
  focused: 115,
  offline: 170,
  sad: 140,
  walking: 72,
};

function rect(parts, x, y, width, height, fill) {
  parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`);
}

function palette(state) {
  return state === 'offline' ? offlineColors : colors;
}

function stateOptions(state, frame) {
  const twitch = [-5, 2, -2, 6, -4, 3, -6, 1][frame];
  const bob = [0, -3, -1, 2, -2, 4, -4, 1][frame];
  const opts = {
    state,
    frame,
    p: palette(state),
    bob,
    lean: [0, -1, 2, -2, 1, 0, -3, 2][frame],
    earLeft: frame % 2 === 0 ? 0 : -3,
    earRight: frame % 3 === 0 ? -4 : 1,
    tail: twitch,
    eyes: 'wild',
    mouth: 'smirk',
    arms: 'down',
    step: frame % 4,
    side: false,
    curls: frame % 2,
  };

  if (state === 'happy') {
    opts.bob = [0, -8, -12, -7, 0, -10, -14, -6][frame];
    opts.lean = twitch > 0 ? 4 : -4;
    opts.eyes = 'joy';
    opts.mouth = frame % 2 === 0 ? 'tongue' : 'grin';
    opts.arms = 'flail';
    opts.tail = twitch * 1.6;
  } else if (state === 'talking') {
    opts.eyes = 'wild';
    opts.mouth = ['small', 'open', 'grin', 'open', 'tiny', 'open', 'tongue', 'open'][frame];
    opts.arms = frame % 2 === 0 ? 'point' : 'down';
  } else if (state === 'thinking') {
    opts.lean = [-6, -5, -3, -1, 2, 3, 1, -2][frame];
    opts.eyes = 'side';
    opts.mouth = 'flat';
    opts.arms = 'chin';
  } else if (state === 'sleepy') {
    opts.bob = [5, 6, 5, 7, 6, 5, 6, 7][frame];
    opts.eyes = 'sleep';
    opts.mouth = frame % 4 === 0 ? 'drool' : 'tiny';
    opts.tail = -3;
  } else if (state === 'surprised') {
    opts.bob = frame % 2 === 0 ? -7 : 1;
    opts.earLeft = -8;
    opts.earRight = -8;
    opts.eyes = 'huge';
    opts.mouth = 'o';
    opts.arms = 'up';
  } else if (state === 'focused') {
    opts.lean = 5;
    opts.eyes = 'laser';
    opts.mouth = 'flat';
    opts.arms = 'clutch';
    opts.tail = [-1, 0, 1, 0, -1, 0, 1, 0][frame];
  } else if (state === 'offline') {
    opts.bob = 4;
    opts.eyes = 'blank';
    opts.mouth = 'flat';
    opts.tail = 0;
  } else if (state === 'sad') {
    opts.bob = [5, 6, 5, 4, 5, 6, 5, 4][frame];
    opts.eyes = 'sad';
    opts.mouth = 'sad';
    opts.arms = 'down';
    opts.tail = -6;
  } else if (state === 'walking') {
    opts.side = true;
    opts.bob = frame % 2 === 0 ? 0 : -3;
    opts.lean = frame % 2 === 0 ? 5 : -2;
    opts.eyes = 'side';
    opts.mouth = 'smirk';
    opts.tail = [7, 2, -3, -7, -3, 2, 7, 3][frame];
  }

  return opts;
}

function drawTail(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const t = Math.round(opts.tail);
  const baseX = opts.side ? 134 : 136;
  rect(parts, baseX + t, 130 + y, 12, 16, p.ink);
  rect(parts, baseX + 9 + t, 116 + y, 14, 16, p.fur);
  rect(parts, baseX + 19 + t, 102 + y, 12, 16, p.ink);
  rect(parts, baseX + 28 + t, 88 + y, 14, 16, p.furLight);
  rect(parts, baseX + 34 + t, 82 + y, 10, 10, p.ink);
}

function drawFeet(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  if (opts.side) {
    const left = opts.step === 0 ? -8 : opts.step === 2 ? 4 : 0;
    const right = opts.step === 2 ? 10 : opts.step === 0 ? -2 : 4;
    rect(parts, 62 + left, 178 + y, 24, 12, p.ink);
    rect(parts, 104 + right, 178 + y, 26, 12, p.ink);
    rect(parts, 68 + left, 174 + y, 10, 4, p.furLight);
    rect(parts, 112 + right, 174 + y, 10, 4, p.furLight);
    return;
  }
  const twitch = opts.frame % 2 === 0 ? -2 : 1;
  rect(parts, 58, 178 + y + twitch, 24, 12, p.ink);
  rect(parts, 110, 178 + y - twitch, 24, 12, p.ink);
  rect(parts, 64, 174 + y + twitch, 10, 4, p.furLight);
  rect(parts, 116, 174 + y - twitch, 10, 4, p.furLight);
}

function drawBody(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 62 + lean, 118 + y, 68, 60, p.ink);
  rect(parts, 70 + lean, 112 + y, 52, 70, p.fur);
  rect(parts, 78 + lean, 126 + y, 36, 44, p.cream);
  rect(parts, 70 + lean, 114 + y, 52, 8, p.deep);
  rect(parts, 88 + lean, 120 + y, 18, 10, p.collar);
  rect(parts, 94 + lean, 130 + y, 10, 10, p.bell);
  rect(parts, 76 + lean + (opts.curls ? 2 : -2), 136 + y, 8, 8, p.furLight);
  rect(parts, 108 + lean + (opts.curls ? -1 : 2), 150 + y, 8, 8, p.deep);
  rect(parts, 84 + lean, 160 + y, 8, 8, p.furLight);
}

function drawArms(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  if (opts.arms === 'flail') {
    rect(parts, 42 + lean, 112 + y, 20, 12, p.ink);
    rect(parts, 34 + lean, 104 + y, 14, 14, p.furLight);
    rect(parts, 128 + lean, 104 + y, 20, 12, p.ink);
    rect(parts, 146 + lean, 96 + y, 14, 14, p.furLight);
  } else if (opts.arms === 'up') {
    rect(parts, 42 + lean, 108 + y, 18, 14, p.ink);
    rect(parts, 132 + lean, 108 + y, 18, 14, p.ink);
    rect(parts, 38 + lean, 98 + y, 12, 12, p.furLight);
    rect(parts, 146 + lean, 98 + y, 12, 12, p.furLight);
  } else if (opts.arms === 'point') {
    rect(parts, 42 + lean, 136 + y, 18, 12, p.ink);
    rect(parts, 128 + lean, 124 + y, 32, 10, p.ink);
    rect(parts, 156 + lean, 120 + y, 10, 10, p.furLight);
  } else if (opts.arms === 'chin') {
    rect(parts, 42 + lean, 136 + y, 18, 12, p.ink);
    rect(parts, 126 + lean, 122 + y, 18, 18, p.ink);
    rect(parts, 136 + lean, 116 + y, 10, 10, p.furLight);
  } else if (opts.arms === 'clutch') {
    rect(parts, 48 + lean, 140 + y, 28, 12, p.ink);
    rect(parts, 116 + lean, 140 + y, 28, 12, p.ink);
    rect(parts, 72 + lean, 138 + y, 9, 9, p.furLight);
    rect(parts, 112 + lean, 138 + y, 9, 9, p.furLight);
  } else {
    rect(parts, 44 + lean, 134 + y, 18, 18, p.ink);
    rect(parts, 130 + lean, 134 + y, 18, 18, p.ink);
    rect(parts, 48 + lean, 144 + y, 10, 10, p.furLight);
    rect(parts, 134 + lean, 144 + y, 10, 10, p.furLight);
  }
}

function drawEar(parts, x, y, flip, opts) {
  const p = opts.p;
  const s = flip ? -1 : 1;
  rect(parts, x, y + 30, 28, 18, p.ink);
  rect(parts, x + s * 4, y + 18, 28, 18, p.ink);
  rect(parts, x + s * 8, y + 6, 24, 18, p.ink);
  rect(parts, x + s * 12, y, 16, 14, p.ink);
  rect(parts, x + s * 8, y + 24, 14, 18, p.furLight);
  rect(parts, x + s * 13, y + 10, 10, 16, p.blush);
}

function drawHead(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  drawEar(parts, 44 + lean, 44 + y + opts.earLeft, false, opts);
  drawEar(parts, 148 + lean, 44 + y + opts.earRight, true, opts);
  rect(parts, 58 + lean, 76 + y, 78, 70, p.ink);
  rect(parts, 48 + lean, 94 + y, 100, 42, p.ink);
  rect(parts, 64 + lean, 82 + y, 66, 58, p.fur);
  rect(parts, 56 + lean, 100 + y, 84, 30, p.fur);
  rect(parts, 82 + lean, 112 + y, 34, 28, p.cream);
  rect(parts, 62 + lean, 86 + y, 20, 22, p.furLight);
  rect(parts, 110 + lean, 82 + y, 18, 24, p.deep);
  rect(parts, 72 + lean + (opts.curls ? 0 : 4), 72 + y, 10, 10, p.furLight);
  rect(parts, 88 + lean + (opts.curls ? 4 : -2), 68 + y, 10, 10, p.deep);
  rect(parts, 104 + lean + (opts.curls ? -3 : 3), 72 + y, 10, 10, p.furLight);
  rect(parts, 60 + lean, 130 + y, 8, 8, p.blush);
  rect(parts, 130 + lean, 130 + y, 8, 8, p.blush);
}

function drawEyes(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  const eyeY = 96 + y;
  if (opts.eyes === 'sleep') {
    rect(parts, 70 + lean, eyeY + 12, 20, 5, p.ink);
    rect(parts, 116 + lean, eyeY + 12, 20, 5, p.ink);
    return;
  }
  if (opts.eyes === 'blank') {
    rect(parts, 72 + lean, eyeY + 2, 18, 24, p.ink);
    rect(parts, 116 + lean, eyeY + 2, 18, 24, p.ink);
    rect(parts, 78 + lean, eyeY + 8, 6, 12, p.eye);
    rect(parts, 122 + lean, eyeY + 8, 6, 12, p.eye);
    return;
  }
  if (opts.eyes === 'huge') {
    rect(parts, 66 + lean, eyeY - 6, 28, 32, p.ink);
    rect(parts, 114 + lean, eyeY - 6, 28, 32, p.ink);
    rect(parts, 72 + lean, eyeY, 16, 22, p.eye);
    rect(parts, 120 + lean, eyeY, 16, 22, p.eyeAlt);
    rect(parts, 78 + lean, eyeY + 8, 8, 10, p.pupil);
    rect(parts, 122 + lean, eyeY + 4, 8, 10, p.pupil);
    rect(parts, 76 + lean, eyeY, 4, 4, '#ffffff');
    rect(parts, 128 + lean, eyeY, 4, 4, '#ffffff');
    return;
  }
  if (opts.eyes === 'joy') {
    rect(parts, 68 + lean, eyeY + 10, 24, 6, p.ink);
    rect(parts, 116 + lean, eyeY + 10, 24, 6, p.ink);
    rect(parts, 74 + lean, eyeY + 16, 12, 5, p.ink);
    rect(parts, 122 + lean, eyeY + 16, 12, 5, p.ink);
    return;
  }
  if (opts.eyes === 'laser') {
    rect(parts, 66 + lean, eyeY + 4, 30, 8, p.ink);
    rect(parts, 112 + lean, eyeY + 4, 30, 8, p.ink);
    rect(parts, 76 + lean, eyeY + 12, 12, 8, p.eye);
    rect(parts, 120 + lean, eyeY + 12, 12, 8, p.eye);
    return;
  }
  if (opts.eyes === 'sad') {
    rect(parts, 70 + lean, eyeY + 4, 22, 20, p.ink);
    rect(parts, 116 + lean, eyeY + 4, 22, 20, p.ink);
    rect(parts, 78 + lean, eyeY + 10, 8, 10, p.eye);
    rect(parts, 124 + lean, eyeY + 10, 8, 10, p.eye);
    rect(parts, 90 + lean, eyeY + 22, 6, 12, p.tear);
    return;
  }
  if (opts.eyes === 'side') {
    rect(parts, 70 + lean, eyeY, 22, 26, p.ink);
    rect(parts, 116 + lean, eyeY, 22, 26, p.ink);
    rect(parts, 80 + lean, eyeY + 5, 7, 16, p.eye);
    rect(parts, 126 + lean, eyeY + 5, 7, 16, p.eyeAlt);
    return;
  }
  rect(parts, 68 + lean, eyeY - 1, 24, 28, p.ink);
  rect(parts, 116 + lean, eyeY + 1, 22, 26, p.ink);
  rect(parts, 74 + lean, eyeY + 4 + (opts.frame % 2), 12, 18, p.eye);
  rect(parts, 122 + lean, eyeY + 2 - (opts.frame % 2), 10, 18, p.eyeAlt);
  rect(parts, 78 + lean, eyeY + 10, 6, 8, p.pupil);
  rect(parts, 124 + lean, eyeY + 6, 6, 8, p.pupil);
  rect(parts, 76 + lean, eyeY + 4, 4, 4, '#ffffff');
  rect(parts, 128 + lean, eyeY + 2, 4, 4, '#ffffff');
}

function drawMouth(parts, opts) {
  const p = opts.p;
  const y = opts.bob;
  const lean = opts.lean;
  rect(parts, 98 + lean, 124 + y, 8, 4, p.ink);
  if (opts.mouth === 'grin') {
    rect(parts, 90 + lean, 132 + y, 30, 12, p.ink);
    rect(parts, 96 + lean, 132 + y, 6, 5, p.cream);
    rect(parts, 106 + lean, 132 + y, 6, 5, p.cream);
    rect(parts, 100 + lean, 138 + y, 12, 6, p.tongue);
  } else if (opts.mouth === 'tongue') {
    rect(parts, 94 + lean, 132 + y, 22, 12, p.ink);
    rect(parts, 102 + lean, 138 + y, 8, 10, p.tongue);
  } else if (opts.mouth === 'open') {
    rect(parts, 96 + lean, 132 + y, 18, 12, p.ink);
    rect(parts, 102 + lean, 138 + y, 8, 4, p.tongue);
  } else if (opts.mouth === 'o') {
    rect(parts, 98 + lean, 130 + y, 16, 18, p.ink);
    rect(parts, 102 + lean, 136 + y, 8, 8, p.tongue);
  } else if (opts.mouth === 'sad') {
    rect(parts, 94 + lean, 138 + y, 8, 4, p.ink);
    rect(parts, 102 + lean, 134 + y, 16, 4, p.ink);
    rect(parts, 118 + lean, 138 + y, 8, 4, p.ink);
  } else if (opts.mouth === 'drool') {
    rect(parts, 100 + lean, 134 + y, 12, 4, p.ink);
    rect(parts, 110 + lean, 138 + y, 4, 12, p.tear);
  } else if (opts.mouth === 'flat') {
    rect(parts, 94 + lean, 134 + y, 26, 4, p.ink);
  } else {
    rect(parts, 94 + lean, 132 + y, 10, 4, p.ink);
    rect(parts, 108 + lean, 132 + y, 10, 4, p.ink);
  }
}

function drawFrame(state, frame) {
  const opts = stateOptions(state, frame);
  const parts = [];
  drawTail(parts, opts);
  drawFeet(parts, opts);
  drawBody(parts, opts);
  drawArms(parts, opts);
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
    id: 'chaos-devon-rex',
    name: 'Chaos Devon Rex',
    description: 'A bug-eyed, big-eared pixel Devon Rex with twitchy chaotic energy.',
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

const outDir = path.join(__dirname, '..', 'assets', 'pets', 'chaos-devon-rex');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'spritesheet.svg'), buildSvg());
fs.writeFileSync(path.join(outDir, 'pet.json'), `${JSON.stringify(buildManifest(), null, 2)}\n`);
console.log(`Generated ${path.relative(process.cwd(), outDir)}`);
