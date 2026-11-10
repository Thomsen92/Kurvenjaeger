/* ---------- Daten ---------- */
const LAPS = 3, ROAD_HALF = 64, CURB = 6, EDGE = 104, RAMP_H = 11, G = 250, GAPLEN = 20;
const KARTS = [
  { id: 'blitz', name: 'Blitz', role: 'Schnell', color: 0xff4b3e, css: '#ff4b3e', max: 156, acc: 58, turn: 1.9, grip: 5.2, mass: 1 },
  { id: 'brummi', name: 'Brummi', role: 'Stabil', color: 0xffd23f, css: '#ffd23f', max: 146, acc: 54, turn: 2.0, grip: 8.5, mass: 1.5 },
  { id: 'wiesel', name: 'Wiesel', role: 'Wendig', color: 0x4fd8ff, css: '#4fd8ff', max: 140, acc: 74, turn: 2.35, grip: 6.5, mass: 0.8 }
];
const CHARS = [
  { id: 'tom', name: 'Tom', kind: 'Tomate', note: 'Saftig, ausgewogen und fix.', torso: 0xc92a3a, mods: { max: 1, acc: 1, turn: 1, grip: 1, mass: 1 } },
  { id: 'anna', name: 'Anna', kind: 'Rennfahrerin', note: 'Flink, mit wehendem Zopf.', torso: 0x7a5cff, mods: { max: 0.97, acc: 1.05, turn: 1.14, grip: 1, mass: 0.9 } },
  { id: 'flavio', name: 'Flavio', kind: 'Kartprofi', note: 'Schwer und schnell.', torso: 0x2b4fa8, mods: { max: 1.06, acc: 1, turn: 0.92, grip: 1, mass: 1.3 } },
  { id: 'quaki', name: 'Quaki', kind: 'Frosch', note: 'Haftet wie Kleber.', torso: 0xff7a59, mods: { max: 1, acc: 0.95, turn: 1, grip: 1.2, mass: 1 } },
  { id: 'janos', name: 'Janos', kind: 'Tigerente', note: 'Startet wie ein Blitz.', torso: 0xffc83d, mods: { max: 0.97, acc: 1.2, turn: 1, grip: 1, mass: 0.95 } }
];
const MOD_NAMES = { max: 'Tempo', acc: 'Antritt', turn: 'Lenkung', grip: 'Haftung', mass: 'Gewicht' };
const FACES = {
  tom: '<circle cx="24" cy="29" r="16" fill="#e63946"/><circle cx="18" cy="31" r="2.2" fill="#fff"/><circle cx="30" cy="31" r="2.2" fill="#fff"/><circle cx="18.6" cy="31.3" r="1.1" fill="#111"/><circle cx="30.6" cy="31.3" r="1.1" fill="#111"/><path d="M18 37q6 5 12 0" fill="none" stroke="#7a1620" stroke-width="2.2" stroke-linecap="round"/><rect x="22.4" y="2" width="3.2" height="7" rx="1.6" fill="#2f8f3a"/><path d="M24 9l-6 2 4 1-3 3 5-2 5 2-3-3 4-1z" fill="#3aa655"/><path d="M10 24a14 12 0 0 1 28 0z" fill="#2b6fd0"/><rect x="8" y="22.5" width="32" height="3.4" rx="1.7" fill="#2b6fd0"/><circle cx="24" cy="14.6" r="6" fill="#fff"/><text x="24" y="16.4" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#2b6fd0">T</text>',
  anna: '<ellipse cx="40" cy="32" rx="5" ry="11" fill="#f2c94c"/><circle cx="24" cy="25" r="17" fill="#f2c94c"/><circle cx="24" cy="29" r="12.5" fill="#f2c6a0"/><path d="M10 25q14-17 28 0q-5-7-14-7t-14 7z" fill="#f2c94c"/><circle cx="19" cy="29" r="2" fill="#111"/><circle cx="29" cy="29" r="2" fill="#111"/><path d="M20 35q4 3 8 0" fill="none" stroke="#c0394e" stroke-width="2" stroke-linecap="round"/><circle cx="37" cy="20" r="3" fill="#ff4b9a"/>',
  flavio: '<circle cx="24" cy="29" r="15" fill="#f2c6a0"/><path d="M8 25a16 16 0 0 1 32 0z" fill="#d62828"/><rect x="26" y="22" width="19" height="5" rx="2.5" fill="#d62828"/><circle cx="22" cy="15" r="6.4" fill="#fff"/><text x="22" y="19.6" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#d62828">F</text><circle cx="18" cy="31" r="2" fill="#111"/><circle cx="30" cy="31" r="2" fill="#111"/><ellipse cx="24" cy="34" rx="3.4" ry="3" fill="#e8a07c"/><path d="M24 37q-4 -2 -10 1q2 5 10 1q8 4 10 -1q-6 -3 -10 -1z" fill="#3a2418"/>',
  janos: '<circle cx="24" cy="30" r="15" fill="#ffd23f"/><path d="M13 22l3 7M24 20v8M35 22l-3 7" stroke="#222" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="31" r="4" fill="#fff"/><circle cx="31" cy="31" r="4" fill="#fff"/><circle cx="18" cy="31.5" r="2" fill="#111"/><circle cx="32" cy="31.5" r="2" fill="#111"/><ellipse cx="24" cy="39" rx="8" ry="4.2" fill="#ff8a1f"/><path d="M9 23a15 13 0 0 1 30 0z" fill="#2b6fd0"/><rect x="27" y="21" width="17" height="4" rx="2" fill="#2b6fd0"/><circle cx="21" cy="13" r="6" fill="#fff"/><text x="21" y="17.4" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#2b6fd0">J</text>',
  quaki: '<circle cx="24" cy="33" r="14" fill="#8ae068"/><circle cx="12" cy="24" r="6" fill="#8ae068"/><circle cx="36" cy="24" r="6" fill="#8ae068"/><circle cx="12" cy="24" r="4" fill="#fff"/><circle cx="36" cy="24" r="4" fill="#fff"/><circle cx="13" cy="24.5" r="2" fill="#111"/><circle cx="37" cy="24.5" r="2" fill="#111"/><path d="M14 37q10 7 20 0" fill="none" stroke="#14301b" stroke-width="3" stroke-linecap="round"/><path d="M10 19a14 14 0 0 1 28 0z" fill="#1f9d3a"/><rect x="8" y="17.5" width="32" height="3.6" rx="1.8" fill="#1f9d3a"/><circle cx="24" cy="10" r="6.6" fill="#fff"/><text x="24" y="15" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" fill="#1f9d3a">L</text>',
};

const hx = n => '#' + ('000000' + n.toString(16)).slice(-6);
/* Skins: [Name, Hauptfarbe, Akzent, Oberkörper]; Skin 0 = Original */
const CHAR_SKINS = {
  tom: [['Original', 0xe63946, 0x2b6fd0, 0xc92a3a], ['Gelb', 0xffc83d, 0xe63946, 0xe0a82e], ['Grün', 0x7ac143, 0x2b2f4a, 0x5a9a2e]],
  anna: [['Original', 0xf2c94c, 0xff4b9a, 0x7a5cff], ['Rot', 0xd9482f, 0xffd23f, 0x2fd0c0], ['Dunkel', 0x3a2a24, 0x4fd8ff, 0xff4b9a]],
  flavio: [['Original', 0xd62828, 0x3a2418, 0x2b4fa8], ['Grün', 0x2f9e44, 0x1b1e27, 0xd62828], ['Blau', 0x2f6fd0, 0x7a5a3a, 0xffd23f]],
  janos: [['Original', 0xffd23f, 0x2b6fd0, 0xffc83d], ['Orange', 0xffa030, 0xe63946, 0xff8a2b], ['Hell', 0xfff0a0, 0x2fa05a, 0xffe066]],
  quaki: [['Original', 0x8ae068, 0x1f9d3a, 0xff7a59], ['Lila', 0xb36bff, 0xffd23f, 0x2fd0c0], ['Gold', 0xffc83d, 0xe0502f, 0x5a3aa0]]
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
    loop: true, sky: ['#25b2e8', '#d6f4ff'], top: '#f1d28a', cliff: ['#c99a52', '#dcb06a'], curb: [0x2fa8e0, 0xffffff], decor: 'water', puddle: 'water', walker: 'duck', sun: 0xfff4d8 }
];
const BOTS = [{ name: 'Rex' }, { name: 'Mimi' }, { name: 'Olli' }, { name: 'Lotte' }, { name: 'Pepe' }, { name: 'Zora' }, { name: 'Bruno' }];
const DIFF_SKILL = [0.8, 0.9, 0.98];
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

export { LAPS, ROAD_HALF, CURB, EDGE, RAMP_H, G, GAPLEN, KARTS, CHARS, MOD_NAMES, FACES, hx, CHAR_SKINS, KART_SKINS, faceSvg, TRACKS, BOTS, DIFF_SKILL, ITEMS, ITEM_W };
