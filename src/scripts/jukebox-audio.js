/**
 * A tiny WebAudio band for the jukebox.
 *
 * Everything here is synthesised on the fly — there are no audio files, and
 * none of these tunes are recordings of anything. Each "45" is a chord
 * progression plus a transposing riff, played by four voices: upright-ish
 * bass, comping chords, a lead, and a drum kit made of noise bursts.
 */

const NOTE = {};
{
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let octave = 1; octave <= 6; octave++) {
    names.forEach((name, i) => {
      NOTE[name + octave] = 440 * Math.pow(2, (i - 9 + (octave - 4) * 12) / 12);
    });
  }
}

const CHORD_TONES = {
  '7': [0, 4, 7, 10],
  maj: [0, 4, 7],
  min: [0, 3, 7],
  min7: [0, 3, 7, 10],
};

/** Twelve-bar blues in the given key, as [root, quality] per bar. */
function blues(i, iv, v) {
  return [
    [i, '7'], [i, '7'], [i, '7'], [i, '7'],
    [iv, '7'], [iv, '7'], [i, '7'], [i, '7'],
    [v, '7'], [iv, '7'], [i, '7'], [v, '7'],
  ];
}

/** Fifties doo-wop turnaround: I – vi – IV – V. */
function doowop(i, vi, iv, v) {
  return [
    [i, 'maj'], [vi, 'min'], [iv, 'maj'], [v, '7'],
    [i, 'maj'], [vi, 'min'], [iv, 'maj'], [v, '7'],
  ];
}

export const TRACKS = [
  {
    id: 'A1',
    title: 'Cheesesteak Shuffle',
    artist: 'The Griddle Kings',
    bpm: 134,
    swing: 0.62,
    label: '#e02438',
    chords: blues('A', 'D', 'E'),
    riff: [0, 3, 5, 6, 5, 3, 0, -2],
    lead: 'square',
  },
  {
    id: 'A2',
    title: 'Booth Nine Boogie',
    artist: 'Lou & The Short Orders',
    bpm: 158,
    swing: 0.6,
    label: '#f5b528',
    chords: blues('G', 'C', 'D'),
    riff: [0, 2, 3, 4, 3, 2, 0, 7],
    lead: 'sawtooth',
  },
  {
    id: 'A3',
    title: 'Malt Shop Stomp',
    artist: 'Rosie Vane',
    bpm: 146,
    swing: 0.58,
    label: '#19b4a6',
    chords: blues('E', 'A', 'B'),
    riff: [0, 5, 7, 10, 7, 5, 3, 0],
    lead: 'square',
  },
  {
    id: 'B1',
    title: 'Neon In The Rain',
    artist: 'The Carhops',
    bpm: 92,
    swing: 0.5,
    label: '#ffe9c4',
    chords: doowop('C', 'A', 'F', 'G'),
    riff: [0, 4, 7, 4, 7, 12, 7, 4],
    lead: 'triangle',
  },
  {
    id: 'B2',
    title: 'Last Call At The Counter',
    artist: 'Rosie Vane',
    bpm: 84,
    swing: 0.5,
    label: '#c77dff',
    chords: doowop('G', 'E', 'C', 'D'),
    riff: [0, 3, 7, 10, 7, 3, 2, 0],
    lead: 'triangle',
  },
  {
    id: 'B3',
    title: 'Chrome & Chrome',
    artist: 'The Griddle Kings',
    bpm: 168,
    swing: 0.56,
    label: '#4cc9f0',
    chords: blues('D', 'G', 'A'),
    riff: [0, 7, 10, 12, 10, 7, 3, 0],
    lead: 'sawtooth',
  },
];

export class Jukebox {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.timer = null;
    this.track = null;
    this.muted = false;
  }

  /** Must be called from a user gesture — iOS will not start audio otherwise. */
  async ensureContext() {
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

  /** A single synth note with a percussive envelope. */
  _tone(freq, at, dur, { type = 'square', gain = 0.2, cutoff = 2600 } = {}) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;

    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(gain * 0.55, at + dur * 0.45);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(lp).connect(amp).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Noise-based percussion: short for hats, longer and filtered for snare. */
  _hit(at, { dur = 0.08, cutoff = 6000, type = 'highpass', gain = 0.18 } = {}) {
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filt.type = type;
    filt.frequency.value = cutoff;

    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    src.connect(filt).connect(amp).connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  _kick(at) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.11);
    amp.gain.setValueAtTime(0.5, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(amp).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.25);
  }

  /** Surface noise, so it sounds like vinyl rather than a browser tab. */
  _startCrackle() {
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    amp.gain.value = 0.022;
    src.connect(hp).connect(amp).connect(this.master);
    src.start();
    this.noise = src;
  }

  _scheduleBar(track, barIndex, at) {
    const beat = 60 / track.bpm;
    const [rootName, quality] = track.chords[barIndex % track.chords.length];
    const root = NOTE[rootName + '2'];
    const tones = CHORD_TONES[quality];
    const semi = (n) => root * Math.pow(2, n / 12);

    // Walking bass: root, third, fifth, sixth of the bar's chord.
    const walk = [tones[0], tones[1], tones[2], 9];
    for (let b = 0; b < 4; b++) {
      this._tone(semi(walk[b]), at + b * beat, beat * 0.9, {
        type: 'triangle',
        gain: 0.34,
        cutoff: 900,
      });
    }

    // Comp chords on the backbeat.
    for (const b of [1, 3]) {
      tones.forEach((t, i) => {
        this._tone(semi(t) * 2, at + b * beat, beat * 0.42, {
          type: 'square',
          gain: 0.075 - i * 0.008,
          cutoff: 2200,
        });
      });
    }

    // Kit.
    for (let b = 0; b < 4; b++) {
      if (b % 2 === 0) this._kick(at + b * beat);
      else this._hit(at + b * beat, { dur: 0.17, cutoff: 1400, type: 'bandpass', gain: 0.3 });
      // Swung eighths on the hats.
      this._hit(at + b * beat, { dur: 0.05, gain: 0.1 });
      this._hit(at + (b + track.swing) * beat, { dur: 0.04, gain: 0.06 });
    }

    // Lead riff, transposed to sit over whatever chord the bar is on.
    track.riff.forEach((offset, i) => {
      const t = at + (i % 2 === 0 ? i / 2 : (i - 1) / 2 + track.swing) * beat;
      this._tone(semi(offset) * 4, t, beat * 0.4, {
        type: track.lead,
        gain: 0.11,
        cutoff: 3400,
      });
    });
  }

  play(track) {
    if (!this.ctx) return;
    this.stop({ keepContext: true });
    this.track = track;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime + 0.5);

    this._startCrackle();

    const beat = 60 / track.bpm;
    let bar = 0;
    let next = this.ctx.currentTime + 0.12;

    const pump = () => {
      while (next < this.ctx.currentTime + 0.5) {
        this._scheduleBar(track, bar, next);
        next += beat * 4;
        bar++;
      }
      this.timer = setTimeout(pump, 120);
    };
    pump();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        muted ? 0 : 0.85,
        this.ctx.currentTime + 0.15,
      );
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
      m.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.25);
      setTimeout(() => m.disconnect(), 400);
    }
    this.master = null;
    this.track = null;
  }
}
