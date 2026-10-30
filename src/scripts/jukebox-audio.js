/**
 * A tiny WebAudio band for the jukebox.
 *
 * Everything is synthesised on the fly — no audio files, and none of these are
 * recordings of anything. Each side has its own arranger: a function that
 * schedules one bar in that genre's style, so the kit, bassline, comping and
 * lead all change with the record, not just the chords.
 */

/* ------------------------------------------------------------------ *
 * Notes and chords
 * ------------------------------------------------------------------ */

const PITCH_CLASS = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const QUALITY = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  6: [0, 4, 7, 9],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  m9: [0, 3, 7, 10, 14],
  9: [0, 4, 7, 10, 14],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

const chordCache = new Map();

/** "Bbmaj7" -> { pc: 10, tones: [0,4,7,11] } */
function parseChord(symbol) {
  let parsed = chordCache.get(symbol);
  if (!parsed) {
    const m = /^([A-G][#b]?)(.*)$/.exec(symbol);
    parsed = { pc: PITCH_CLASS[m[1]], tones: QUALITY[m[2]] || QUALITY[''] };
    chordCache.set(symbol, parsed);
  }
  return parsed;
}

/** Frequency of a pitch class in a given octave. */
function hz(pc, octave) {
  return 440 * Math.pow(2, (pc - 9 + (octave - 4) * 12) / 12);
}

/** Frequency of a chord tone: `step` indexes the chord, beyond it wraps up an octave. */
function tone(chord, step, octave) {
  const n = chord.tones.length;
  const semi = chord.tones[((step % n) + n) % n] + 12 * Math.floor(step / n);
  return hz(chord.pc, octave) * Math.pow(2, semi / 12);
}

/** Frequency of an arbitrary interval above the chord root. */
function above(chord, semitones, octave) {
  return hz(chord.pc, octave) * Math.pow(2, semitones / 12);
}

/* ------------------------------------------------------------------ *
 * Arrangers — one bar each, in that genre's idiom
 * ------------------------------------------------------------------ */

const ARRANGERS = {
  /** Shuffle kit, boogie bass, triplet piano, blues lick. */
  rock(J, t, bar, at, chord) {
    const b = 60 / t.bpm;
    const sw = t.swing;
    const boogie = [0, 4, 7, 9, 10, 9, 7, 4];

    for (let i = 0; i < 8; i++) {
      const when = at + (Math.floor(i / 2) + (i % 2 ? sw : 0)) * b;
      J.osc({ type: 'triangle', freq: above(chord, boogie[i], 2), at: when, dur: b * 0.42, gain: 0.3, cutoff: 1100 });
    }

    for (let q = 0; q < 4; q++) {
      if (q % 2 === 0) J.kick(at + q * b, { gain: 0.46 });
      else J.snare(at + q * b, { gain: 0.34 });
      J.hat(at + q * b, { gain: 0.085 });
      J.hat(at + (q + sw) * b, { gain: 0.055 });
    }

    // Piano triplets on the backbeat.
    for (const q of [1, 3]) {
      for (let v = 0; v < 3; v++) {
        chord.tones.forEach((s) =>
          J.osc({ type: 'square', freq: above(chord, s, 4), at: at + (q + v * 0.11) * b, dur: b * 0.14, gain: 0.038, cutoff: 2600 }),
        );
      }
    }

    // Lead lays out for a bar in four, so the loop breathes.
    if (bar % 4 !== 3) {
      [0, 3, 5, 6, 5, 3].forEach((s, i) => {
        const when = at + (Math.floor(i / 2) + (i % 2 ? sw : 0)) * b;
        J.osc({ type: 'square', freq: above(chord, s, 4), at: when, dur: b * 0.3, gain: 0.075, cutoff: 3200 });
      });
    }
  },

  /** Backbeat and tambourine, busy melodic bass, horn stabs. */
  motown(J, t, bar, at, chord) {
    const b = 60 / t.bpm;

    for (const q of [0, 2]) J.kick(at + q * b, { gain: 0.44, pitch: 115, drop: 48 });
    J.kick(at + 2.5 * b, { gain: 0.3, pitch: 110, drop: 45 });
    for (const q of [1, 3]) J.snare(at + q * b, { gain: 0.42, cutoff: 1500 });
    for (let i = 0; i < 8; i++) {
      J.hat(at + i * b * 0.5, { gain: i % 2 ? 0.07 : 0.045, dur: 0.035, cutoff: 7800 });
    }

    // Jamerson-ish bass: chord tones with a passing note into the next bar.
    const walk = [0, 0, 7, 0, 4, 7, 10, 11];
    for (let i = 0; i < 8; i++) {
      J.osc({
        type: 'triangle', freq: above(chord, walk[i], 2),
        at: at + i * b * 0.5, dur: b * 0.4, gain: 0.3, cutoff: 1000,
      });
    }

    // Horn section on the upbeats.
    for (const o of [1.5, 3.5]) {
      chord.tones.slice(0, 3).forEach((s, i) =>
        J.osc({ type: 'square', freq: above(chord, s, 4), at: at + o * b, dur: b * 0.3, gain: 0.07 - i * 0.012, cutoff: 2800, attack: 0.02, send: 0.12 }),
      );
    }

    // Answering string line in the second half of the phrase.
    if (bar % 4 >= 2) {
      [7, 9, 12].forEach((s, i) =>
        J.osc({ type: 'sawtooth', freq: above(chord, s, 4), at: at + (2 + i * 0.5) * b, dur: b * 0.45, gain: 0.04, cutoff: 1900, attack: 0.08 }),
      );
    }
  },

  /** Train beat, boom-chick bass, major triads, pentatonic lick with a slide. */
  country(J, t, bar, at, chord) {
    const b = 60 / t.bpm;

    for (const q of [0, 2]) J.kick(at + q * b, { gain: 0.38, pitch: 105, drop: 42 });
    // Brushed train-beat eighths, accented on the backbeat.
    for (let i = 0; i < 8; i++) {
      const strong = i === 2 || i === 6;
      J.snare(at + i * b * 0.5, {
        gain: strong ? 0.3 : 0.1, dur: strong ? 0.1 : 0.05, cutoff: strong ? 1900 : 3400,
      });
    }

    // Alternating root and fifth.
    for (let q = 0; q < 4; q++) {
      J.osc({
        type: 'triangle', freq: above(chord, q % 2 ? 7 : 0, q % 2 ? 1 : 2),
        at: at + q * b, dur: b * 0.8, gain: 0.3, cutoff: 850,
      });
    }

    // Acoustic-ish chop on two and four.
    for (const q of [1, 3]) {
      chord.tones.forEach((s, i) =>
        J.osc({ type: 'triangle', freq: above(chord, s, 4), at: at + q * b + i * 0.012, dur: b * 0.35, gain: 0.06, cutoff: 3200 }),
      );
    }

    // Telecaster lick, with a bend into the third.
    if (bar % 4 === 3) {
      [0, 2, 4, 7].forEach((s, i) =>
        J.osc({ type: 'square', freq: above(chord, s, 5), at: at + i * b * 0.5, dur: b * 0.4, gain: 0.07, cutoff: 3600 }),
      );
    } else if (bar % 2 === 0) {
      J.osc({ type: 'square', freq: above(chord, 3, 4), at: at + 2.5 * b, dur: b * 0.6, gain: 0.08, cutoff: 3400, slideTo: above(chord, 4, 4) });
    }
  },

  /** Ride pattern, brushes, walking bass, rootless piano voicings. */
  jazz(J, t, bar, at, chord, next) {
    const b = 60 / t.bpm;
    const sw = t.swing;

    // Ride: ding, ding-da, across the bar.
    for (let q = 0; q < 4; q++) {
      J.hat(at + q * b, { gain: 0.075, dur: 0.14, cutoff: 6200 });
      if (q % 2 === 1) J.hat(at + (q + sw) * b, { gain: 0.05, dur: 0.1, cutoff: 6600 });
    }
    for (const q of [1, 3]) J.snare(at + q * b, { gain: 0.12, dur: 0.07, cutoff: 3800 });
    J.kick(at, { gain: 0.16, pitch: 95, drop: 40 });

    // Walking bass: root, third, fifth, then a half-step approach to the next bar.
    const target = hz(next.pc, 2);
    const approach = target * Math.pow(2, (bar % 2 ? 1 : -1) / 12);
    const line = [tone(chord, 0, 2), tone(chord, 1, 2), tone(chord, 2, 2), approach];
    line.forEach((f, q) =>
      J.osc({ type: 'triangle', freq: f, at: at + q * b, dur: b * 0.92, gain: 0.3, cutoff: 780 }),
    );

    // Comping: syncopated, and in a different place each bar.
    const hits = [[0.5, 2.5], [1.5, 3], [0, 2.5], [1.5, 3.5]][bar % 4];
    for (const o of hits) {
      chord.tones.slice(1).forEach((s, i) =>
        J.osc({ type: 'triangle', freq: above(chord, s, 4), at: at + o * b + i * 0.009, dur: b * 0.5, gain: 0.055, cutoff: 2400, attack: 0.012, send: 0.16 }),
      );
    }

    // A bebop-ish line over the second half of the form.
    if (bar % 4 >= 2) {
      [0, 2, 3, 4, 7, 6, 4, 2].forEach((s, i) => {
        const when = at + (Math.floor(i / 2) + (i % 2 ? sw : 0)) * b;
        J.osc({ type: 'sine', freq: above(chord, s, 5), at: when, dur: b * 0.3, gain: 0.07, cutoff: 3000, attack: 0.008 });
      });
    }
  },

  /** Four on the floor, offbeat open hats, octave bass, filtered stabs. */
  house(J, t, bar, at, chord) {
    const b = 60 / t.bpm;

    for (let q = 0; q < 4; q++) {
      J.kick(at + q * b, { gain: 0.62, pitch: 160, drop: 46, dur: 0.3 });
      J.hat(at + (q + 0.5) * b, { gain: 0.12, dur: 0.11, cutoff: 9200 });
      J.hat(at + q * b, { gain: 0.035, dur: 0.028, cutoff: 10500 });
    }
    for (const q of [1, 3]) J.clap(at + q * b);

    // Octave-jumping bass, the engine of the whole thing.
    for (let i = 0; i < 8; i++) {
      J.osc({
        type: 'sawtooth', freq: hz(chord.pc, i % 2 ? 2 : 1),
        at: at + i * b * 0.5, dur: b * 0.4, gain: 0.26, cutoff: 460, q: 7,
      });
    }

    // Stabs on the and-of-two and and-of-four, swept open across the phrase.
    const sweep = 900 + (bar % 8) * 320;
    for (const o of [1.5, 3.5]) {
      chord.tones.forEach((s, i) =>
        J.osc({
          type: 'sawtooth', freq: above(chord, s, 4), at: at + o * b, dur: b * 0.34,
          gain: 0.06 - i * 0.006, cutoff: sweep, q: 5, send: 0.3,
        }),
      );
    }

    // Pad underneath, opening up every eight bars.
    chord.tones.forEach((s) =>
      J.osc({
        type: 'sawtooth', freq: above(chord, s, 3), at, dur: b * 3.9,
        gain: 0.028, cutoff: 500, sweepTo: sweep, attack: 0.4,
      }),
    );
  },

  /** Half-time break, long sub, reese stabs, sixteenth hats. */
  dnb(J, t, bar, at, chord) {
    const b = 60 / t.bpm;
    const second = bar % 2 === 1;

    // Two-bar break: snare lands on three both bars, kicks move around it.
    J.kick(at, { gain: 0.58, pitch: 135, drop: 42, dur: 0.24 });
    J.snare(at + 2 * b, { gain: 0.46, dur: 0.15, cutoff: 1900 });
    if (second) {
      J.kick(at + 1.5 * b, { gain: 0.4 });
      J.snare(at + 3.25 * b, { gain: 0.3, dur: 0.1, cutoff: 2600 });
      J.snare(at + 3.5 * b, { gain: 0.22, dur: 0.07, cutoff: 3200 });
    } else {
      J.kick(at + 2.75 * b, { gain: 0.44 });
    }

    for (let i = 0; i < 16; i++) {
      J.hat(at + i * b * 0.25, { gain: i % 4 === 2 ? 0.07 : 0.03, dur: 0.026, cutoff: 9800 });
    }

    // Sub bass holds the root for half the bar.
    J.osc({ type: 'sine', freq: hz(chord.pc, 1), at, dur: b * 1.9, gain: 0.52, cutoff: 190, attack: 0.02 });
    J.osc({ type: 'sine', freq: hz(chord.pc, 1), at: at + 2 * b, dur: b * 1.7, gain: 0.44, cutoff: 190, attack: 0.02 });

    // Reese: two detuned saws beating against each other.
    if (bar % 4 >= 2) {
      for (const cents of [-9, 9]) {
        J.osc({
          type: 'sawtooth', freq: hz(chord.pc, 2), at: at + 2 * b, dur: b * 1.6,
          gain: 0.07, cutoff: 700, sweepTo: 1600, detune: cents, q: 4,
        });
      }
    }

    // Sparse minor stabs, well off the grid.
    for (const o of [0.75, 2.5]) {
      chord.tones.forEach((s, i) =>
        J.osc({ type: 'square', freq: above(chord, s, 4), at: at + o * b, dur: b * 0.2, gain: 0.045 - i * 0.006, cutoff: 2600, send: 0.34 }),
      );
    }
  },
};

/* ------------------------------------------------------------------ *
 * The records
 * ------------------------------------------------------------------ */

export const TRACKS = [
  {
    id: 'A1', title: 'Griddle Rock', artist: 'The Counter Kings', genre: 'Rock & Roll',
    style: 'rock', bpm: 152, swing: 0.62, label: '#e02438',
    chords: ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'A7', 'E7', 'B7'],
  },
  {
    id: 'A2', title: 'Sweet Booth Nine', artist: 'Rosie Vane', genre: 'Motown',
    style: 'motown', bpm: 126, swing: 0.5, label: '#f5b528',
    chords: ['C', 'Am', 'Dm7', 'G7', 'C', 'Am', 'F', 'G7'],
  },
  {
    id: 'A3', title: 'Two-Lane Diner', artist: 'Hank Mulberry', genre: 'Country',
    style: 'country', bpm: 118, swing: 0.5, label: '#f2a65a',
    chords: ['G', 'G', 'C', 'G', 'D', 'C', 'G', 'D'],
  },
  {
    id: 'B1', title: 'Last Call', artist: 'The Blue Plate Trio', genre: 'Jazz',
    style: 'jazz', bpm: 136, swing: 0.64, label: '#19b4a6',
    chords: ['Gm7', 'C7', 'Fmaj7', 'Fmaj7', 'Gm7', 'C7', 'Am7', 'D7'],
  },
  {
    id: 'B2', title: 'Neon Deep', artist: 'DJ Provolone', genre: 'House',
    style: 'house', bpm: 124, swing: 0.5, label: '#c77dff',
    chords: ['Am7', 'Am7', 'Fmaj7', 'Fmaj7', 'Dm7', 'Dm7', 'Em7', 'Em7'],
  },
  {
    id: 'B3', title: 'Cheesesteak Breaks', artist: "Rollin' Phill", genre: 'Drum & Bass',
    style: 'dnb', bpm: 174, swing: 0.5, label: '#4cc9f0',
    chords: ['Dm9', 'Dm9', 'Bbmaj7', 'Bbmaj7', 'F', 'F', 'Am7', 'Am7'],
  },
];

// Guard against a typo in a chord symbol turning into a silent wrong chord.
for (const t of TRACKS) {
  t.chords = t.chords.map((c) => {
    if (!/^([A-G][#b]?)(.*)$/.test(c) || !(/^([A-G][#b]?)(.*)$/.exec(c)[2] in QUALITY)) {
      throw new Error(`Bad chord symbol "${c}" in ${t.id}`);
    }
    return c;
  });
}

/* ------------------------------------------------------------------ *
 * Playback
 * ------------------------------------------------------------------ */

// 0.05s of digital silence. Playing this through a media element puts iOS into
// its "playback" audio session, which is what makes the ringer switch stop
// muting us. See unlock() below.
const SILENCE =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

export class Jukebox {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.send = null;
    this.noise = null;
    this.timer = null;
    this.silent = null;
    this.muted = false;
  }

  /**
   * Must run inside a user gesture. Does two things iOS needs: asks for the
   * playback audio session (Safari 16.4+), and keeps a silent media element
   * looping as a fallback for older versions. Without one of those, WebAudio
   * output follows the hardware ringer switch and the page is silent even with
   * the volume all the way up.
   */
  async unlock() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* not supported here */
    }

    if (!this.silent) {
      const el = new Audio(SILENCE);
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.volume = 0.0001;
      this.silent = el;
    }
    try {
      await this.silent.play();
    } catch {
      /* blocked; the audioSession path may still have worked */
    }
  }

  async ensureContext() {
    await this.unlock();

    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.noiseBuffer = this._buildNoise();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx.state === 'running';
  }

  _buildNoise() {
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** One synth note. */
  osc({ type = 'square', freq, at, dur, gain = 0.2, cutoff = 2600, q = 0.7, sweepTo, slideTo, detune = 0, attack = 0.012, send = 0 }) {
    const o = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();

    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur * 0.7);
    o.detune.value = detune;

    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(cutoff, at);
    if (sweepTo) lp.frequency.linearRampToValueAtTime(sweepTo, at + dur);

    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + attack);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain * 0.5, 0.0002), at + dur * 0.5);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    o.connect(lp).connect(amp).connect(this.master);
    if (send > 0 && this.send) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      amp.connect(s).connect(this.send);
    }
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  _burst(at, { dur, cutoff, type, gain, q = 0.7 }) {
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    filt.type = type;
    filt.frequency.value = cutoff;
    filt.Q.value = q;

    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    src.connect(filt).connect(amp).connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  hat(at, { gain = 0.08, dur = 0.04, cutoff = 8000 } = {}) {
    this._burst(at, { dur, cutoff, type: 'highpass', gain });
  }

  snare(at, { gain = 0.34, dur = 0.16, cutoff = 1600 } = {}) {
    this._burst(at, { dur, cutoff, type: 'bandpass', gain, q: 0.9 });
  }

  clap(at, gain = 0.26) {
    // Three quick bursts read as a clap rather than a snare.
    [0, 0.012, 0.026].forEach((o, i) =>
      this._burst(at + o, { dur: i === 2 ? 0.14 : 0.03, cutoff: 1900, type: 'bandpass', gain: gain * (i === 2 ? 1 : 0.6), q: 1.4 }),
    );
  }

  kick(at, { gain = 0.5, pitch = 125, drop = 42, dur = 0.22 } = {}) {
    const o = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch, at);
    o.frequency.exponentialRampToValueAtTime(drop, at + dur * 0.5);
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(amp).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  /** Surface noise, so it sounds like a record rather than a browser tab. */
  _startCrackle() {
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    amp.gain.value = 0.016;
    src.connect(hp).connect(amp).connect(this.master);
    src.start();
    this.noise = src;
  }

  play(track) {
    if (!this.ctx) return;
    this.stop();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(this.ctx.destination);

    // Shared delay, used by the genres that want air around the stabs.
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    delay.connect(fb).connect(delay);
    delay.connect(this.master);
    this.send = delay;

    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime + 0.4);
    this._startCrackle();
    if (this.silent) this.silent.play().catch(() => {});

    const arrange = ARRANGERS[track.style];
    const beat = 60 / track.bpm;
    const prog = track.chords.map(parseChord);
    let bar = 0;
    let next = this.ctx.currentTime + 0.12;

    const pump = () => {
      while (next < this.ctx.currentTime + 0.5) {
        const i = bar % prog.length;
        arrange(this, track, bar, next, prog[i], prog[(i + 1) % prog.length]);
        next += beat * 4;
        bar++;
      }
      this.timer = setTimeout(pump, 110);
    };
    pump();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.8, this.ctx.currentTime + 0.15);
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    if (this.noise) {
      try {
        this.noise.stop();
      } catch {
        /* already stopped */
      }
      this.noise = null;
    }

    if (this.master && this.ctx) {
      const m = this.master;
      m.gain.cancelScheduledValues(this.ctx.currentTime);
      m.gain.setValueAtTime(m.gain.value, this.ctx.currentTime);
      m.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.22);
      setTimeout(() => m.disconnect(), 400);
    }
    this.master = null;
    this.send = null;

    if (this.silent) this.silent.pause();
  }
}
