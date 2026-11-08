/* ---------- Daten ---------- */
const LAPS = 3, ROAD_HALF = 64, CURB = 6, EDGE = 104, RAMP_H = 11, G = 250, GAPLEN = 20;
const KARTS = [
  { id: 'blitz', name: 'Blitz', role: 'Schnell', color: 0xff4b3e, css: '#ff4b3e', max: 156, acc: 58, turn: 1.9, grip: 5.2, mass: 1 },
  { id: 'brummi', name: 'Brummi', role: 'Stabil', color: 0xffd23f, css: '#ffd23f', max: 146, acc: 54, turn: 2.0, grip: 8.5, mass: 1.5 },
  { id: 'wiesel', name: 'Wiesel', role: 'Wendig', color: 0x4fd8ff, css: '#4fd8ff', max: 140, acc: 74, turn: 2.35, grip: 6.5, mass: 0.8 }
];
const CHARS = [
  { id: 'quaki', name: 'Quaki', kind: 'Frosch', note: 'Haftet wie Kleber.', torso: 0xff7a59, mods: { max: 1, acc: 0.95, turn: 1, grip: 1.2, mass: 1 } },
  { id: 'pip', name: 'Pip', kind: 'Pinguin', note: 'Startet wie eine Rakete.', torso: 0xe63946, mods: { max: 0.97, acc: 1.2, turn: 1, grip: 1, mass: 0.95 } },
  { id: 'bolzen', name: 'Bolzen', kind: 'Roboter', note: 'Schwer und schnell.', torso: 0x6b7a99, mods: { max: 1.06, acc: 1, turn: 0.92, grip: 1, mass: 1.3 } },
  { id: 'mausi', name: 'Mausi', kind: 'Katze', note: 'Flink um jede Kurve.', torso: 0x4fd8ff, mods: { max: 0.97, acc: 1, turn: 1.14, grip: 1, mass: 0.9 } },
  { id: 'broesel', name: 'Brösel', kind: 'Mops', note: 'Rammt alles weg.', torso: 0x7a5cff, mods: { max: 1, acc: 1.02, turn: 1, grip: 1.1, mass: 1.2 } },
  { id: 'wuschel', name: 'Wuschel', kind: 'Monster', note: 'Wuselig und wendig.', torso: 0xffb347, mods: { max: 1, acc: 1.1, turn: 1.06, grip: 0.95, mass: 0.85 } }
];
const MOD_NAMES = { max: 'Tempo', acc: 'Antritt', turn: 'Lenkung', grip: 'Haftung', mass: 'Gewicht' };
const FACES = {
  quaki: '<circle cx="24" cy="29" r="16" fill="#5fd37a"/><circle cx="14" cy="14" r="7" fill="#5fd37a"/><circle cx="34" cy="14" r="7" fill="#5fd37a"/><circle cx="14" cy="14" r="4.6" fill="#fff"/><circle cx="34" cy="14" r="4.6" fill="#fff"/><circle cx="15" cy="14.5" r="2.2" fill="#111"/><circle cx="35" cy="14.5" r="2.2" fill="#111"/><path d="M13 31q11 9 22 0" fill="none" stroke="#14301b" stroke-width="3" stroke-linecap="round"/>',
  pip: '<circle cx="24" cy="25" r="18" fill="#20314f"/><ellipse cx="24" cy="29" rx="12" ry="11" fill="#fff"/><circle cx="18" cy="21" r="3.2" fill="#111"/><circle cx="30" cy="21" r="3.2" fill="#111"/><path d="M19 28h10l-5 7z" fill="#ff9f1c"/>',
  bolzen: '<rect x="8" y="12" width="32" height="28" rx="6" fill="#aab4c8"/><rect x="12" y="20" width="24" height="9" rx="4" fill="#4fd8ff"/><rect x="22.5" y="5" width="3" height="8" fill="#6b7a99"/><circle cx="24" cy="5" r="3.2" fill="#ff4b3e"/><rect x="16" y="33" width="16" height="3" rx="1.5" fill="#6b7a99"/>',
  mausi: '<path d="M8 22 11 5l11 8zM40 22 37 5 26 13z" fill="#ff9a3c"/><circle cx="24" cy="28" r="16" fill="#ff9a3c"/><circle cx="18" cy="25" r="3" fill="#111"/><circle cx="30" cy="25" r="3" fill="#111"/><path d="M22 31h4l-2 3z" fill="#ff7aa8"/><path d="M6 30h10M6 34l10-1M42 30H32M42 34l-10-1" stroke="#fff" stroke-width="1.5"/>',
  broesel: '<ellipse cx="9" cy="22" rx="5" ry="10" fill="#4a3426"/><ellipse cx="39" cy="22" rx="5" ry="10" fill="#4a3426"/><circle cx="24" cy="25" r="16" fill="#d9b98c"/><ellipse cx="24" cy="31" rx="9" ry="7" fill="#4a3426"/><circle cx="18" cy="21" r="3.2" fill="#111"/><circle cx="30" cy="21" r="3.2" fill="#111"/><rect x="21.5" y="35" width="5" height="6" rx="2.5" fill="#ff7aa8"/>',
  wuschel: '<path d="M14 14 12 4l8 6zM34 14l2-10-8 6z" fill="#ffd23f"/><circle cx="24" cy="26" r="17" fill="#9b6cff"/><circle cx="24" cy="23" r="9" fill="#fff"/><circle cx="25.5" cy="23" r="4.2" fill="#111"/><path d="M15 36q9 6 18 0" fill="none" stroke="#2b1760" stroke-width="3" stroke-linecap="round"/>'
};

const hx = n => '#' + ('000000' + n.toString(16)).slice(-6);
/* Skins: [Name, Hauptfarbe, Akzent, Oberkörper]; Skin 0 = Original */
const CHAR_SKINS = {
  quaki: [['Original', 0x5fd37a, 0x14301b, 0xff7a59], ['Lila', 0xb36bff, 0x2a1450, 0x2fd0c0], ['Gold', 0xffc83d, 0x5a3a00, 0xe0502f]],
  pip: [['Original', 0x20314f, 0xff9f1c, 0xe63946], ['Eis', 0x3b82c4, 0xffd23f, 0x1d3557], ['Rosa', 0xd9468f, 0xffe066, 0x6a1b9a]],
  bolzen: [['Original', 0xaab4c8, 0x4fd8ff, 0x6b7a99], ['Gold', 0xe0b84e, 0xff4b3e, 0x7a5a1e], ['Neon', 0x2b2f4a, 0x62ff8a, 0x1a1d2e]],
  mausi: [['Original', 0xff9a3c, 0xff7aa8, 0x4fd8ff], ['Grau', 0x9aa3b5, 0xff7aa8, 0xff7aa8], ['Nacht', 0x2b2b36, 0xffd23f, 0xffd23f]],
  broesel: [['Original', 0xd9b98c, 0x4a3426, 0x7a5cff], ['Schoko', 0x8a5a3c, 0x2a1a10, 0xff7a59], ['Weiß', 0xf2efe6, 0x9a8f80, 0x2fd0c0]],
  wuschel: [['Original', 0x9b6cff, 0xffd23f, 0xffb347], ['Grün', 0x4fd37a, 0xff4b9a, 0x7a5cff], ['Rot', 0xff5a4a, 0xfff2a8, 0x2b2f4a]]
};
/* Lacke: [Name, Farbe, Zweitfarbe, Muster] */
const KART_SKINS = {
  blitz: [['Rennrot', 0xff4b3e, 0xffffff, 'stripe'], ['Mitternacht', 0x2b3a8f, 0xffd23f, 'sides'], ['Limette', 0x7ae03a, 0x1b1e27, 'dots']],
  brummi: [['Sonnengelb', 0xffd23f, 0x1b1e27, 'sides'], ['Wald', 0x2f8f4a, 0xf2e6c8, 'stripe'], ['Orange', 0xff8a2b, 0xffffff, 'dots']],
  wiesel: [['Himmel', 0x4fd8ff, 0xffffff, 'dots'], ['Pink', 0xff5ab8, 0xfff2a8, 'stripe'], ['Violett', 0x8a5cff, 0x4fd8ff, 'sides']]
};
function faceSvg(id, k) {
  let t = FACES[id]; const base = CHAR_SKINS[id][0], sk = CHAR_SKINS[id][k];
  for (let j = 1; j <= 2; j++) t = t.split(hx(base[j])).join('@' + j + '@');
  for (let j = 1; j <= 2; j++) t = t.split('@' + j + '@').join(hx(sk[j]));
  return t;
}
const TRACKS = [
  { id: 'muhland', name: 'Muh-Farm', info: 'Feldweg, Kühe, Schlammpfützen', R: 830, gaps: 3,
    f: t => 1 + 0.22 * Math.sin(3 * t) + 0.09 * Math.cos(5 * t + 0.5) + 0.05 * Math.sin(8 * t + 1),
    sky: ['#3f9bea', '#d8efff'], top: '#6ab04c', cliff: ['#7a5538', '#94693f'], curb: [0xe0b84e, 0x9b6b2b], decor: 'farm', puddle: 'mud', walker: 'cow', sun: 0xfff1d6 },
  { id: 'zuckerland', name: 'Zuckerland', info: 'Keks-Straße, Sirup, Gummibärchen', R: 890, gaps: 4,
    f: t => 1 + 0.23 * Math.sin(2 * t + 0.8) + 0.07 * Math.cos(4 * t) + 0.02 * Math.sin(7 * t),
    sky: ['#ff9bd2', '#ffe6f4'], top: '#ffb3d9', sprinkles: true, cliff: ['#5a3324', '#74422f'], curb: [0xff6ad5, 0xffffff], decor: 'candy', puddle: 'syrup', walker: 'gummy', sun: 0xffe0f0 },
  { id: 'plansch', name: 'Plansch-Park', info: 'Holzsteg, rutschige Pfützen, Enten', R: 860, gaps: 3,
    f: t => 1 + 0.2 * Math.sin(4 * t + 0.3) + 0.1 * Math.cos(3 * t) + 0.04 * Math.sin(6 * t + 2),
    sky: ['#25b2e8', '#d6f4ff'], top: '#f1d28a', cliff: ['#c99a52', '#dcb06a'], curb: [0x2fa8e0, 0xffffff], decor: 'water', puddle: 'water', walker: 'duck', sun: 0xfff4d8 }
];
const BOTS = [{ name: 'Rex', skill: 0.88 }, { name: 'Mimi', skill: 0.92 }, { name: 'Olli', skill: 0.95 }];
const ITEMS = {
  banana: { name: 'Banane', svg: '<path d="M9 28c3 11 20 15 31 4 2-2 1-5-2-4-9 6-17 2-21-8-1-3-9-2-8 8z" fill="#ffd23f" stroke="#8a6b00" stroke-width="2.2" stroke-linejoin="round"/><circle cx="11" cy="22" r="2.4" fill="#6b4a00"/>' },
  shield: { name: 'Schild', svg: '<circle cx="24" cy="24" r="16" fill="rgba(79,216,255,.35)" stroke="#4fd8ff" stroke-width="3"/><path d="M15 20a11 11 0 0 1 8-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' },
  mushroom: { name: 'Pilz', svg: '<path d="M7 26a17 15 0 0 1 34 0z" fill="#ff4b3e"/><circle cx="17" cy="20" r="3.4" fill="#fff"/><circle cx="31" cy="18" r="3.8" fill="#fff"/><rect x="16" y="26" width="16" height="13" rx="6" fill="#f6e9cf"/>' },
  rocket: { name: 'Rakete', svg: '<path d="M24 4c8 6 10 17 8 26H16c-2-9 0-20 8-26z" fill="#f2f2f2" stroke="#444" stroke-width="2"/><circle cx="24" cy="17" r="3.6" fill="#4fd8ff"/><path d="M16 29l-7 9 9-3zM32 29l7 9-9-3z" fill="#ff4b3e"/><path d="M20 32h8l-4 11z" fill="#ffa030"/>' },
  feather: { name: 'Feder', svg: '<path d="M38 6C22 8 10 20 9 40c4-3 7-7 9-11 6 1 12-1 16-7-4 0-7-1-9-3 6 0 10-3 13-8-4 1-7 0-10-1 4-2 7-5 10-10z" fill="#e8f6ff" stroke="#4a86b8" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 40 30 18" stroke="#4a86b8" stroke-width="2.2" stroke-linecap="round"/>' },
  iceball: { name: 'Eisball', svg: '<circle cx="24" cy="24" r="15" fill="#bfeaff" stroke="#3b9ad8" stroke-width="2.4"/><path d="M24 10v28M12 17l24 14M36 17 12 31" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' },
  ink: { name: 'Tinte', svg: '<path d="M24 6c5 7 12 10 11 18 6 1 8 8 3 11-3 2-6 0-8 2-2 5-5 6-6 6s-4-1-6-6c-2-2-5 0-8-2-5-3-3-10 3-11-1-8 6-11 11-18z" fill="#2b2f4a" stroke="#0e1118" stroke-width="2"/><circle cx="19" cy="26" r="3" fill="#fff"/><circle cx="29" cy="26" r="3" fill="#fff"/><circle cx="20" cy="27" r="1.4" fill="#111"/><circle cx="30" cy="27" r="1.4" fill="#111"/>' },
  magnet: { name: 'Magnet', svg: '<path d="M11 8v18a13 13 0 0 0 26 0V8" fill="none" stroke="#e23b30" stroke-width="9"/><path d="M6.5 8h9M32.5 8h9" stroke="#dfe6f3" stroke-width="9"/><path d="M6.5 8h9M32.5 8h9" stroke="#8a93a8" stroke-width="2"/>' },
  bolt: { name: 'Blitz', svg: '<path d="M28 3 11 27h11l-3 18 18-26H26z" fill="#ffd23f" stroke="#8a6b00" stroke-width="2.2" stroke-linejoin="round"/>' }
};
const ITEM_W = [
  { banana: 28, shield: 24, mushroom: 18, rocket: 8, bolt: 0, feather: 14, iceball: 6, ink: 2, magnet: 0 },
  { banana: 16, shield: 14, mushroom: 18, rocket: 22, bolt: 4, feather: 10, iceball: 8, ink: 4, magnet: 4 },
  { banana: 8, shield: 10, mushroom: 20, rocket: 24, bolt: 8, feather: 8, iceball: 8, ink: 6, magnet: 8 },
  { banana: 4, shield: 8, mushroom: 22, rocket: 18, bolt: 14, feather: 6, iceball: 8, ink: 8, magnet: 12 }
];

export { LAPS, ROAD_HALF, CURB, EDGE, RAMP_H, G, GAPLEN, KARTS, CHARS, MOD_NAMES, FACES, hx, CHAR_SKINS, KART_SKINS, faceSvg, TRACKS, BOTS, ITEMS, ITEM_W };
