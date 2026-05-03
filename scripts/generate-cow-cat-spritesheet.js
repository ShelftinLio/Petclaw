const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'assets', 'pets', 'cow-cat', 'spritesheet.svg');
const W = 192;
const H = 208;
const CELL = 4;
const COLS = 8;
const ROWS = 10;

const states = ['idle', 'happy', 'talking', 'thinking', 'sleepy', 'surprised', 'focused', 'offline', 'sad', 'walking'];
const loop = [0, 1, 2, 3, 4, 3, 2, 1];

function px(x, y, w, h, fill) {
  return `<rect x="${x * CELL}" y="${y * CELL}" width="${w * CELL}" height="${h * CELL}" fill="${fill}"/>`;
}

function rect(parts, x, y, w, h, fill) {
  parts.push(px(x, y, w, h, fill));
}

function drawCuteCowCat(parts, dx, dy, state, frame) {
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
  const hop = walking ? (gait === 1 || gait === 3 ? -2 : 0) : happy ? -Math.max(0, 3 - Math.abs(step - 2)) : step === 4 ? -1 : 0;
  const y = dy + hop + (sleepy ? 2 : 0) + (sad ? 1 : 0);
  const dim = offline ? ' opacity="0.55"' : '';
  const eyeY = y + (surprised ? 16 : 18);
  const eyeH = blink || sleepy ? 1 : surprised ? 7 : 6;
  const mouthOpen = talking && frame % 2 === 1;
  const tailY = walking ? [0, -1, -3, -1, 0, 1, 2, 1][frame] : happy ? -Math.max(0, 3 - Math.abs(step - 2)) : -1;
  const frontLeg = walking ? (gait < 2 ? -2 : 2) : 0;
  const backLeg = walking ? (gait < 2 ? 2 : -2) : 0;

  parts.push(`<g${dim}>`);

  // Big soft tail, readable from far away.
  rect(parts, dx + 33, y + 28 + tailY, 3, 6, '#111111');
  rect(parts, dx + 36, y + 22 + tailY, 3, 8, '#111111');
  rect(parts, dx + 37, y + 18 + tailY, 4, 4, '#111111');
  rect(parts, dx + 38, y + 18 + tailY, 2, 2, '#ffffff');

  // Tiny alternating paws. Shorter legs make the cat cuter, larger offsets make walking clearer.
  rect(parts, dx + 13 + backLeg, y + 39, 5, 4, '#111111');
  rect(parts, dx + 21 + frontLeg, y + 39, 5, 4, '#111111');
  rect(parts, dx + 29 - frontLeg, y + 39, 5, 4, '#111111');
  rect(parts, dx + 36 - backLeg, y + 39, 5, 4, '#111111');
  rect(parts, dx + 14 + backLeg, y + 38, 3, 1, '#ffffff');
  rect(parts, dx + 30 - frontLeg, y + 38, 3, 1, '#ffffff');

  // Squat rounded pixel body.
  rect(parts, dx + 9, y + 25, 31, 14, '#111111');
  rect(parts, dx + 11, y + 23, 27, 18, '#111111');
  rect(parts, dx + 12, y + 25, 25, 12, '#ffffff');
  rect(parts, dx + 14, y + 34, 21, 4, '#fff3ee');
  rect(parts, dx + 10, y + 27, 7, 5, '#111111');
  rect(parts, dx + 30, y + 29, 8, 7, '#111111');

  // Oversized ears with white inner pixels.
  rect(parts, dx + 10, y + 10, 4, 5, '#111111');
  rect(parts, dx + 11, y + 7, 4, 4, '#111111');
  rect(parts, dx + 12, y + 5, 3, 3, '#111111');
  rect(parts, dx + 35, y + 10, 4, 5, '#111111');
  rect(parts, dx + 34, y + 7, 4, 4, '#111111');
  rect(parts, dx + 34, y + 5, 3, 3, '#111111');
  rect(parts, dx + 12, y + 9, 2, 4, '#ffffff');
  rect(parts, dx + 35, y + 9, 2, 4, '#ffffff');

  // Chubby head silhouette.
  rect(parts, dx + 10, y + 15, 30, 18, '#111111');
  rect(parts, dx + 8, y + 19, 34, 12, '#111111');
  rect(parts, dx + 12, y + 16, 26, 16, '#ffffff');
  rect(parts, dx + 10, y + 20, 30, 10, '#ffffff');

  // Cow-cat patches: asymmetrical, but face stays bright and cute.
  rect(parts, dx + 15, y + 8, 6, 9, '#111111');
  rect(parts, dx + 21, y + 10, 4, 7, '#111111');
  rect(parts, dx + 31, y + 15, 7, 5, '#111111');
  rect(parts, dx + 35, y + 21, 5, 8, '#111111');

  // Large vertical i-eyes.
  rect(parts, dx + 16, eyeY, 5, eyeH, '#111111');
  rect(parts, dx + 29, eyeY, 5, eyeH, '#111111');
  if (!blink && !sleepy) {
    rect(parts, dx + 17, eyeY + 1, 3, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
    rect(parts, dx + 30, eyeY + 1, 3, Math.max(1, eyeH - 2), surprised ? '#ffffff' : '#dffaff');
    rect(parts, dx + 18, eyeY + 1, 1, 1, '#ffffff');
    rect(parts, dx + 31, eyeY + 1, 1, 1, '#ffffff');
  }

  // Tiny nose, cat mouth, blush, and whiskers.
  rect(parts, dx + 24, y + 26, 2, 1, '#111111');
  if (mouthOpen) {
    rect(parts, dx + 23, y + 28, 4, 3, '#111111');
    rect(parts, dx + 24, y + 30, 2, 1, '#f3aaa4');
  } else if (sad) {
    rect(parts, dx + 23, y + 30, 5, 1, '#111111');
    rect(parts, dx + 22, y + 31, 1, 1, '#111111');
    rect(parts, dx + 28, y + 31, 1, 1, '#111111');
  } else {
    rect(parts, dx + 23, y + 28, 2, 1, '#111111');
    rect(parts, dx + 26, y + 28, 2, 1, '#111111');
  }
  rect(parts, dx + 14, y + 28, 2, 2, '#f3aaa4');
  rect(parts, dx + 35, y + 28, 2, 2, '#f3aaa4');
  rect(parts, dx + 8, y + 25, 6, 1, '#111111');
  rect(parts, dx + 7, y + 29, 7, 1, '#111111');
  rect(parts, dx + 37, y + 25, 6, 1, '#111111');
  rect(parts, dx + 37, y + 29, 7, 1, '#111111');

  if (happy) {
    rect(parts, dx + 16, eyeY + 2, 5, 2, '#111111');
    rect(parts, dx + 29, eyeY + 2, 5, 2, '#111111');
  }
  if (thinking) {
    rect(parts, dx + 39, y + 9 + (frame % 2), 2, 2, '#66f6ff');
    rect(parts, dx + 42, y + 5, 3, 3, '#66f6ff');
  }
  if (focused) {
    rect(parts, dx + 15, y + 16, 8, 1, '#111111');
    rect(parts, dx + 28, y + 16, 8, 1, '#111111');
  }
  if (sleepy) {
    rect(parts, dx + 38, y + 8 + (frame % 3), 2, 2, '#66f6ff');
    rect(parts, dx + 41, y + 5, 3, 2, '#66f6ff');
  }

  parts.push('</g>');
}

function catFrame(state, frame, row) {
  const parts = [];
  drawCuteCowCat(parts, 2, 5, state, frame);
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
