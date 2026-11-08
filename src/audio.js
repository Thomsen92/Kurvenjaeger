/* Ton (synthetisiert mit WebAudio, keine Dateien) */
export const sfx = (() => {
  let ac = null, master = null, dry = null, rev = null, nbuf = null, muted = false;
  const last = {};
  try { muted = localStorage.getItem('kj-mute') === '1'; } catch (e) {}
  const VOL = 0.55;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : VOL;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; master.connect(comp); comp.connect(ac.destination);
      dry = ac.createGain(); dry.connect(master);
      /* Heller Hall aus einem erzeugten Impuls (abklingendes Rauschen) */
      const len = Math.floor(ac.sampleRate * 1.3), ib = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const cv = ac.createConvolver(); cv.buffer = ib; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      rev = ac.createGain(); rev.connect(hp); hp.connect(cv); const rg = ac.createGain(); rg.gain.value = 0.55; cv.connect(rg); rg.connect(master);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const sb = ac.createBufferSource(); sb.buffer = ac.createBuffer(1, 1, 22050); sb.connect(ac.destination); sb.start(0);
      if (ac.resume) ac.resume();
    } catch (e) { ac = null; }
  }
  /* Hall-Anteil: send = 0..1 */
  function out(node, send) { node.connect(dry); if (send) { const g = ac.createGain(); g.gain.value = send; node.connect(g); g.connect(rev); } }
  /* Glockenton (FM): heller, glasiger Klang mit schnellem Obertonabfall; ratio 2 = Marimba, 3.5 = Glas */
  function bell(f, dur, v, o) {
    if (!ac || muted) return; o = o || {};
    const t = ac.currentTime + (o.d || 0), c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.frequency.value = f; m.frequency.value = f * (o.r || 3.5); mg.gain.setValueAtTime(f * (o.i || 1.6), t); mg.gain.exponentialRampToValueAtTime(f * 0.01, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    m.connect(mg); mg.connect(c.frequency); c.connect(g); out(g, o.w === undefined ? 0.5 : o.w); c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  }
  /* Sanfter Sinuston mit Glide (fuer Pops, Boings, Sweeps) */
  function sine(f0, f1, dur, v, o) {
    if (!ac || muted) return; o = o || {};
    const t = ac.currentTime + (o.d || 0), os = ac.createOscillator(), g = ac.createGain(); os.type = o.t || 'sine';
    os.frequency.setValueAtTime(f0, t); if (f1) os.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur * 0.9);
    if (o.vib) { const lf = ac.createOscillator(), lg = ac.createGain(); lf.frequency.value = o.vib; lg.gain.value = f0 * (o.vd || 0.05); lf.connect(lg); lg.connect(os.frequency); lf.start(t); lf.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); out(g, o.w === undefined ? 0.2 : o.w); os.start(t); os.stop(t + dur + 0.05);
  }
  /* Luftiger Wusch: Rauschen mit wanderndem Bandpass und weicher Huellkurve */
  function whoosh(dur, v, f0, f1, o) {
    if (!ac || muted) return; o = o || {};
    const t = ac.currentTime + (o.d || 0), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; fl.type = o.hp ? 'highpass' : 'bandpass'; fl.Q.value = o.q || 1.1; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const pk = o.peak || 0.3; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * pk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); out(g, o.w === undefined ? 0.25 : o.w); s.start(t); s.stop(t + dur + 0.05);
  }
  /* Schimmern: mehrere hohe Sinustoene mit Zittern */
  function shimmer(fs, dur, v, o) { fs.forEach((f, i) => { sine(f, 0, dur, v / fs.length * 1.6, Object.assign({ a: 0.06, vib: 6 + i, vd: 0.006, w: 0.6 }, o || {})); }); }
  const run = (fs, step, dur, v, o) => fs.forEach((f, i) => bell(f, dur, v, Object.assign({ d: i * step }, o)));
  const C4 = 262, E4 = 330, G4 = 392, A4 = 440, C5 = 523, D5 = 587, E5 = 659, G5 = 784, A5 = 880, B5 = 988, C6 = 1047, D6 = 1175, E6 = 1319, G6 = 1568, A6 = 1760, C7 = 2093;
  const A = {
    beep: n => { if (n >= 1) { bell(A4, 0.35, 0.16, { r: 2, i: 1.2, w: 0.3 }); } else { run([C5, E5, G5, C6], 0.02, 0.9, 0.14, { r: 2, i: 1 }); bell(C7, 0.8, 0.07, { w: 0.6 }); } },
    /* Item-Wuerfel: weiche Pop-Ticks beim Rollen, dann ein glaenzendes Ding */
    tick: n => bell([C6, D6, E6, G6, A6][(n || 0) % 5], 0.12, 0.08, { r: 2, i: 0.8, w: 0.2 }),
    reveal: () => { bell(G6, 0.5, 0.12); bell(C7, 0.7, 0.1, { d: 0.06 }); },
    pickup: () => run([C6, E6, G6], 0.04, 0.4, 0.09),
    banana: () => { sine(900, 380, 0.09, 0.2, { w: 0.1 }); sine(500, 220, 0.14, 0.12, { d: 0.04, w: 0.1 }); },
    shield: () => { shimmer([C6, E6, G6, C7], 0.9, 0.12); bell(G6, 0.7, 0.07, { d: 0.05 }); },
    mushroom: () => { whoosh(0.5, 0.22, 500, 5000, { w: 0.35 }); sine(260, 1100, 0.3, 0.12, { a: 0.03, w: 0.3 }); run([E6, G6, C7], 0.06, 0.5, 0.08, { d: 0.12 }); },
    rocket: () => { whoosh(0.7, 0.28, 3000, 500, { peak: 0.15, q: 0.8 }); sine(130, 55, 0.4, 0.22, { w: 0.15 }); },
    iceball: () => { run([C7, G6, E6], 0.05, 0.5, 0.08); whoosh(0.3, 0.07, 7000, 4000, { hp: true }); },
    feather: () => { whoosh(0.45, 0.17, 800, 3500, { w: 0.4 }); run([G6, C7, E6 * 2], 0.07, 0.45, 0.06, { d: 0.12 }); },
    ink: () => { sine(240, 90, 0.35, 0.22, { vib: 11, vd: 0.1, w: 0.1 }); whoosh(0.25, 0.1, 600, 150, { w: 0.1 }); },
    magnet: () => { sine(330, 660, 0.18, 0.1, { t: 'triangle', w: 0.3 }); sine(660, 330, 0.2, 0.09, { t: 'triangle', d: 0.17, w: 0.3 }); bell(A5, 0.5, 0.07, { d: 0.35 }); },
    bolt: () => { whoosh(0.35, 0.22, 6000, 400, { hp: false, peak: 0.1 }); sine(1600, 200, 0.25, 0.1, { t: 'triangle' }); bell(E6, 0.4, 0.07, { d: 0.05 }); },
    /* getroffen: dumpfer Schlag, Comic-Bonk und absteigende Glocken */
    hit: () => { sine(180, 60, 0.22, 0.38, { w: 0.1 }); whoosh(0.16, 0.2, 2500, 300, { peak: 0.05, w: 0.1 }); run([G5, E5, C5], 0.09, 0.45, 0.1, { d: 0.05, r: 2 }); },
    ice: () => { run([C7, G6, E6, C6, G5], 0.045, 0.6, 0.08); whoosh(0.25, 0.08, 8000, 3000, { hp: true }); },
    bump: () => { sine(150, 70, 0.08, 0.22, { w: 0 }); whoosh(0.05, 0.06, 1500, 500, { peak: 0.05, w: 0 }); },
    pad: () => { sine(200, 780, 0.28, 0.2, { vib: 16, vd: 0.04, a: 0.01, w: 0.3 }); bell(C7, 0.5, 0.07, { d: 0.18 }); },
    ramp: () => { whoosh(0.35, 0.12, 500, 2500, { w: 0.3 }); sine(300, 700, 0.25, 0.07, { a: 0.04 }); },
    boost: () => { whoosh(0.5, 0.2, 700, 6000, { peak: 0.25, w: 0.3 }); sine(160, 620, 0.35, 0.1, { a: 0.03 }); },
    chute: () => { sine(900, 350, 0.07, 0.18, { w: 0.2 }); whoosh(0.3, 0.1, 1800, 600, { peak: 0.1, w: 0.4 }); },
    land: () => sine(150, 70, 0.1, 0.2, { w: 0 }),
    fall: () => { sine(1100, 180, 0.8, 0.12, { t: 'triangle', w: 0.3, a: 0.04 }); },
    spin: () => { sine(520, 940, 0.4, 0.1, { vib: 9, vd: 0.12, a: 0.03, w: 0.25 }); },
    lap: () => { run([E5, G5, C6], 0.08, 0.5, 0.11); },
    finish: () => { run([C5, E5, G5, C6, E6], 0.1, 0.9, 0.12, { r: 2, i: 1 }); run([C5, G5, C6, E6, G6], 0.04, 1.6, 0.09, { d: 0.55 }); shimmer([C7, G6], 1.4, 0.08, { d: 0.55 }); },
    respawn: () => { run([G5, C6, E6], 0.06, 0.35, 0.08); }
  };
  const CD = { bump: 220, land: 150, boost: 450, ramp: 350, pad: 300, spin: 400, hit: 200, fall: 600, tick: 0 };
  return {
    init, muted: () => muted, running: () => !!ac && ac.state === 'running',
    play: (n, a) => { try { const now = Date.now(); if (now - (last[n] || 0) < (CD[n] === undefined ? 80 : CD[n])) return; last[n] = now; if (A[n]) A[n](a); } catch (e) {} },
    beep: n => { try { A.beep(n); } catch (e) {} },
    set: m => { muted = m; try { localStorage.setItem('kj-mute', m ? '1' : '0'); } catch (e) {} if (master) master.gain.value = m ? 0 : VOL; },
    engine: () => {}
  };
})();
