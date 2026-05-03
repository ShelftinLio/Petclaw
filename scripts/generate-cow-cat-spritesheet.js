const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'assets', 'pets', 'cow-cat', 'spritesheet.svg');
const W = 192;
const H = 208;
const CELL = 4;
const COLS = 8;
const ROWS = 10;

const states = [
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

const loop = [0, 1, 2, 3, 4, 3, 2, 1];

function px(x, y, w, h, fill) {
  return `<rect x="${x * CELL}" y="${y * CELL}" width="${w * CELL}" height="${h * CELL}" fill="${fill}"/>`;
}

function rect(parts, x, y, w, h, fill) {
  parts.push(px(x, y, w, h, fill));
}

function line(parts, points, fill = '#111111') {
  for (const [x, y, w = 1, h = 1] of points) rect(parts, x, y, w, h, fill);
}

function drawCat(parts, dx, dy, state, frame) {
  const step = loop[frame];
  const happy = state === 'happy';
  const talking = state === 'talking';
  const thinking = state === 'thinking';
  const sleepy = state === 'sleepy';
  const surprised = state === 'surprised';
  const focused = state === 'focused';
  const offline = state === 'offline';
  const sad = state === 'sad';
  const walking = state === 'walking';
  const blink = state === 'idle' && frame === 4;
  const gait = frame % 4;
  const walkLift = walking ? (gait === 1 || gait === 3 ? -2 : 0) : 0;
  const bounce = walking ? (gait === 0 || gait === 2 ? 1 : -1) : happy ? -Math.abs(step - 2) : step === 4 ? -1 : 0;
  const y = dy + bounce + (sleepy ? 2 : 0) + (sad ? 1 : 0);
  const dim = offline ? ' opacity="0.55"' : '';
  const eyeY = y + (surprised ? 15 : 17);
  const eyeH = blink || sleepy ? 1 : surprised ? 7 : 6;
  const tailWave = walking ? [0, -2, -4, -2, 0, 1, 2, 1][frame] : happy ? -Math.max(0, 4 - Math.abs(step - 2)) : -Math.max(0, 2 - Math.abs(step - 2));
  const mouthOpen = talking && frame % 2 === 1;
  const foreStep = walking ? (gait < 2 ? -3 : 2) : 0;
  const rearStep = walking ? (gait < 2 ? 2 : -3) : 0;

  parts.push(`<g${dim}>`);

  // Long upright cat tail with a white tip.
  rect(parts, dx + 35, y + 27 + tailWave, 3, 7, '#111111');
  rect(parts, dx + 38, y + 21 + tailWave, 3, 8, '#111111');
  rect(parts, dx + 37, y + 17 + tailWave, 3, 4, '#111111');
  rect(parts, dx + 38, y + 16 + tailWave, 2, 2, '#ffffff');

  // Four visibly alternating paws for walking.
  rect(parts, dx + 11 + rearStep, y + 40 - walkLift, 5, 4, '#111111');
  rect(parts, dx + 18 + foreStep, y + 39 + walkLift, 5, 5, '#111111');
  rect(parts, dx + 26 - foreStep, y + 39 + walkLift, 5, 5, '#111111');
  rect(parts, dx + 33 - rearStep, y + 40 - walkLift, 5, 4, '#111111');

  // Compact body, white belly, and cow patches.
  rect(parts, dx + 8, y + 25, 31, 15, '#111111');
  rect(parts, dx + 10, y + 23, 27, 18, '#111111');
  rect(parts, dx + 11, y + 25, 25, 13, '#ffffff');
  rect(parts, dx + 13, y + 34, 21, 5, '#fff2ee');
  rect(parts, dx + 10, y + 26, 7, 6, '#111111');
  rect(parts, dx + 29, y + 30, 8, 7, '#111111');
  rect(parts, dx + 30, y + 31, 6, 5, '#111111');

  // Big pointed cat ears.
  line(parts, [
    [9, y - dy + 11, 3, 2], [10, y - dy + 9, 3, 2], [11, y - dy + 7, 3, 2], [12, y - dy + 5, 3, 2],
    [34, y - dy + 11, 3, 2], [33, y - dy + 9, 3, 2], [32, y - dy + 7, 3, 2], [31, y - dy + 5, 3, 2],
  ].map(([x, yy, w, h]) => [dx + x, dy + yy, w, h]));
  line(parts, [
    [12, y - dy + 9, 2, 3], [33, y - dy + 9, 2, 3],
  ].map(([x, yy, w, h]) => [dx + x, dy + yy, w, h]), '#ffffff');

  // Large square cat head.
  rect(parts, dx + 10, y + 14, 28, 20, '#111111');
  rect(parts, dx + 8, y + 18, 32, 14, '#111111');
  rect(parts, dx + 12, y + 15, 24, 17, '#ffffff');
  rect(parts, dx + 10, y + 19, 28, 11, '#ffffff');

  // Cow-cat mask and side patch.
  rect(parts, dx + 16, y + 7, 5, 11, '#111111');
  rect(parts, dx + 21, y + 8, 4, 9, '#111111');
  rect(parts, dx + 27, y + 14, 8, 5, '#111111');
  rect(parts, dx + 34, y + 20, 5, 9, '#111111');

  // i-shaped eyes.
  rect(parts, dx + 17, eyeY, 4, eyeH, '#111111');
  rect(parts, dx + 28, eyeY, 4, eyeH, '#111111');
  if (!blink && !sleepy) {
    rect(parts, dx + 18, eyeY + 1, 2, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
    rect(parts, dx + 29, eyeY + 1, 2, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
  }

  // Cat nose, mouth, and whiskers.
  rect(parts, dx + 24, y + 25, 2, 1, '#111111');
  if (mouthOpen) {
    rect(parts, dx + 23, y + 27, 4, 3, '#111111');
  } else if (sad) {
    rect(parts, dx + 23, y + 28, 4, 1, '#111111');
    rect(parts, dx + 22, y + 29, 1, 1, '#111111');
    rect(parts, dx + 27, y + 29, 1, 1, '#111111');
  } else {
    rect(parts, dx + 23, y + 27, 2, 1, '#111111');
    rect(parts, dx + 26, y + 27, 2, 1, '#111111');
  }
  rect(parts, dx + 9, y + 25, 5, 1, '#111111');
  rect(parts, dx + 8, y + 28, 6, 1, '#111111');
  rect(parts, dx + 36, y + 25, 5, 1, '#111111');
  rect(parts, dx + 36, y + 28, 6, 1, '#111111');

  if (happy) {
    rect(parts, dx + 14, y + 28, 3, 2, '#f3aaa4');
    rect(parts, dx + 33, y + 28, 3, 2, '#f3aaa4');
  }
  if (thinking) {
    rect(parts, dx + 38, y + 9 + (frame % 2), 2, 2, '#111111');
    rect(parts, dx + 41, y + 5, 3, 3, '#111111');
  }
  if (focused) {
    rect(parts, dx + 16, y + 15, 7, 1, '#111111');
    rect(parts, dx + 27, y + 15, 7, 1, '#111111');
  }
  if (sleepy) {
    rect(parts, dx + 37, y + 8 + (frame % 3), 2, 2, '#111111');
    rect(parts, dx + 40, y + 5, 3, 2, '#111111');
  }

  parts.push('</g>');
}

function catFrame(state, frame, row) {
  const parts = [];
  drawCat(parts, 3, 4, state, frame);
  return `
  <g clip-path="url(#clip-${row}-${frame})">
    <g transform="translate(${frame * W} ${row * H})">
      ${parts.join('')}
    </g>
  </g>`;
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * COLS}" height="${H * ROWS}" viewBox="0 0 ${W * COLS} ${H * ROWS}" shape-rendering="crispEdges">`;
svg += '<defs>';
for (let row = 0; row < states.length; row++) {
  for (let frame = 0; frame < COLS; frame++) {
    svg += `<clipPath id="clip-${row}-${frame}"><rect x="${frame * W}" y="${row * H}" width="${W}" height="${H}"/></clipPath>`;
  }
}
svg += '</defs>';
for (let row = 0; row < states.length; row++) {
  for (let frame = 0; frame < COLS; frame++) {
    svg += catFrame(states[row], frame, row);
  }
}
svg += '\n</svg>\n';

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg, 'utf-8');
console.log(out);
