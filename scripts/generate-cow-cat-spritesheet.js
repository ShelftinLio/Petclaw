const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'assets', 'pets', 'cow-cat', 'spritesheet.svg');
const W = 192;
const H = 208;
const COLS = 8;
const ROWS = 9;

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
];

function catFrame(state, frame, row) {
  const bob = Math.round(Math.sin((frame / 8) * Math.PI * 2) * 3);
  const bounce = state === 'happy' ? Math.round(Math.sin((frame / 8) * Math.PI * 2) * 7) : 0;
  const talk = state === 'talking' ? frame % 2 : 0;
  const blink = state === 'idle' && frame === 4;
  const sleep = state === 'sleepy';
  const sad = state === 'sad';
  const surprised = state === 'surprised';
  const focused = state === 'focused';
  const offline = state === 'offline';
  const thinking = state === 'thinking';
  const y = 14 + bob - bounce + (sleep ? 8 : 0) + (sad ? 6 : 0);
  const tilt = thinking ? -4 : focused ? 3 : sad ? -2 : 0;
  const tail = Math.round(Math.sin((frame / 8) * Math.PI * 2) * 9);
  const eyeH = blink || sleep ? 4 : surprised ? 32 : 24;
  const eyeY = blink || sleep ? 70 : surprised ? 56 : 60;
  const mouth = talk ? '<rect x="86" y="95" width="20" height="12" rx="2" fill="#111"/>' : '<rect x="89" y="98" width="14" height="4" rx="2" fill="#111"/>';
  const moodMark = state === 'happy'
    ? '<rect x="66" y="102" width="12" height="6" rx="2" fill="#ffb5b0"/><rect x="116" y="102" width="12" height="6" rx="2" fill="#ffb5b0"/>'
    : '';
  const dim = offline ? ' opacity="0.52"' : '';

  return `
  <g transform="translate(${frame * W},${row * H})">
    <g transform="translate(0 ${y}) rotate(${tilt} 96 92)"${dim}>
      <rect x="70" y="142" width="18" height="28" rx="4" fill="#111"/>
      <rect x="108" y="142" width="18" height="28" rx="4" fill="#111"/>
      <path d="M126 100 C160 ${88 + tail} 165 ${126 + tail} 132 128" fill="none" stroke="#111" stroke-width="18" stroke-linecap="round"/>
      <path d="M129 100 C156 ${91 + tail} 158 ${118 + tail} 134 122" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
      <rect x="45" y="58" width="102" height="88" rx="30" fill="#fff" stroke="#111" stroke-width="8"/>
      <path d="M56 58 L72 25 L90 58 Z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
      <path d="M104 58 L122 25 L138 58 Z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
      <path d="M73 25 L90 58 L107 58 L122 25 L100 37 Z" fill="#111"/>
      <rect x="118" y="103" width="34" height="32" rx="10" fill="#111"/>
      <path d="M50 126 C70 152 118 150 142 125 L142 144 C116 160 72 160 50 144 Z" fill="#fff3ee"/>
      <rect x="66" y="${eyeY}" width="14" height="${eyeH}" rx="5" fill="#ddfbff" stroke="#111" stroke-width="5"/>
      <rect x="112" y="${eyeY}" width="14" height="${eyeH}" rx="5" fill="#ddfbff" stroke="#111" stroke-width="5"/>
      ${mouth}
      ${moodMark}
      ${thinking ? '<rect x="132" y="34" width="9" height="9" rx="2" fill="#111"/><rect x="145" y="25" width="12" height="12" rx="2" fill="#111"/>' : ''}
      ${focused ? '<rect x="60" y="52" width="25" height="6" fill="#111"/><rect x="108" y="52" width="25" height="6" fill="#111"/>' : ''}
    </g>
  </g>`;
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * COLS}" height="${H * ROWS}" viewBox="0 0 ${W * COLS} ${H * ROWS}" shape-rendering="crispEdges">`;
for (let row = 0; row < states.length; row++) {
  for (let frame = 0; frame < COLS; frame++) {
    svg += catFrame(states[row], frame, row);
  }
}
svg += '\n</svg>\n';

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg, 'utf-8');
console.log(out);
