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

function pixelRect(parts, x, y, w, h, fill) {
  parts.push(px(x, y, w, h, fill));
}

function drawBody(parts, dx, dy, state, frame) {
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
  const bob = walking ? -Math.abs(step - 2) % 2 : happy ? -Math.abs(step - 2) : step === 4 ? -1 : 0;
  const y = dy + bob + (sleepy ? 2 : 0) + (sad ? 1 : 0);
  const dim = offline ? ' opacity="0.55"' : '';
  const eyeY = y + (surprised ? 15 : 16);
  const eyeH = blink || sleepy ? 1 : surprised ? 7 : 6;
  const tailLift = walking ? (frame % 2) + 1 : happy ? Math.max(0, 3 - Math.abs(step - 2)) : Math.max(0, 2 - Math.abs(step - 2));
  const mouthOpen = talking && frame % 2 === 1;
  const leftFootX = walking && frame % 4 < 2 ? -1 : 0;
  const rightFootX = walking && frame % 4 >= 2 ? 1 : 0;

  parts.push(`<g${dim}>`);

  // Tail, behind body. It deliberately uses chunky blocks instead of curves.
  pixelRect(parts, dx + 32, y + 23 - tailLift, 5, 4, '#111111');
  pixelRect(parts, dx + 36, y + 22 - tailLift, 3, 3, '#111111');
  pixelRect(parts, dx + 37, y + 19 - tailLift, 3, 3, '#111111');
  pixelRect(parts, dx + 35, y + 20 - tailLift, 2, 2, '#ffffff');

  // Feet.
  pixelRect(parts, dx + 16 + leftFootX, y + 37, 5, 5, '#111111');
  pixelRect(parts, dx + 27 + rightFootX, y + 37, 5, 5, '#111111');

  // Body outline and fill.
  pixelRect(parts, dx + 9, y + 16, 30, 21, '#111111');
  pixelRect(parts, dx + 8, y + 20, 32, 14, '#111111');
  pixelRect(parts, dx + 11, y + 17, 26, 18, '#ffffff');
  pixelRect(parts, dx + 10, y + 21, 28, 12, '#ffffff');
  pixelRect(parts, dx + 12, y + 30, 24, 5, '#fff2ee');

  // Ears and head.
  pixelRect(parts, dx + 11, y + 8, 7, 9, '#111111');
  pixelRect(parts, dx + 30, y + 8, 7, 9, '#111111');
  pixelRect(parts, dx + 13, y + 9, 4, 7, '#ffffff');
  pixelRect(parts, dx + 31, y + 9, 4, 7, '#ffffff');
  pixelRect(parts, dx + 14, y + 15, 20, 13, '#111111');
  pixelRect(parts, dx + 12, y + 18, 24, 15, '#111111');
  pixelRect(parts, dx + 15, y + 16, 18, 12, '#ffffff');
  pixelRect(parts, dx + 13, y + 19, 22, 12, '#ffffff');

  // Cow-cat black patches.
  pixelRect(parts, dx + 18, y + 8, 4, 8, '#111111');
  pixelRect(parts, dx + 23, y + 9, 3, 7, '#111111');
  pixelRect(parts, dx + 29, y + 24, 8, 8, '#111111');
  pixelRect(parts, dx + 30, y + 25, 6, 6, '#111111');

  // Vertical i-like glowing eyes.
  pixelRect(parts, dx + 18, eyeY, 4, eyeH, '#111111');
  pixelRect(parts, dx + 27, eyeY, 4, eyeH, '#111111');
  if (!blink && !sleepy) {
    pixelRect(parts, dx + 19, eyeY + 1, 2, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
    pixelRect(parts, dx + 28, eyeY + 1, 2, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
  }

  // Mouth and mood marks.
  if (mouthOpen) {
    pixelRect(parts, dx + 23, y + 25, 3, 3, '#111111');
  } else if (sad) {
    pixelRect(parts, dx + 23, y + 27, 4, 1, '#111111');
    pixelRect(parts, dx + 22, y + 28, 1, 1, '#111111');
    pixelRect(parts, dx + 27, y + 28, 1, 1, '#111111');
  } else {
    pixelRect(parts, dx + 23, y + 26, 4, 1, '#111111');
  }

  if (happy) {
    pixelRect(parts, dx + 16, y + 25, 3, 2, '#f3aaa4');
    pixelRect(parts, dx + 30, y + 25, 3, 2, '#f3aaa4');
  }
  if (thinking) {
    pixelRect(parts, dx + 36, y + 8 + (frame % 2), 2, 2, '#111111');
    pixelRect(parts, dx + 39, y + 5, 3, 3, '#111111');
  }
  if (focused) {
    pixelRect(parts, dx + 17, y + 14, 6, 1, '#111111');
    pixelRect(parts, dx + 27, y + 14, 6, 1, '#111111');
  }
  if (sleepy) {
    pixelRect(parts, dx + 35, y + 7 + (frame % 3), 2, 2, '#111111');
    pixelRect(parts, dx + 38, y + 4, 3, 2, '#111111');
  }

  parts.push('</g>');
}

function catFrame(state, frame, row) {
  const parts = [];
  drawBody(parts, 4, 5, state, frame);
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
