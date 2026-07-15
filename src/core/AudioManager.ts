import { Howl } from 'howler';

export type SfxName =
  | 'ui'
  | 'pickup'
  | 'gather'
  | 'craft'
  | 'chime'
  | 'quest'
  | 'success'
  | 'fail'
  | 'splash'
  | 'bite'
  | 'dialogue'
  | 'emote'
  | 'place'
  | 'footstep_grass'
  | 'footstep_stone';

export type MusicMood = 'village' | 'valley' | 'night' | 'rain' | 'silence';

/**
 * All audio is generated procedurally with WebAudio so the project ships with
 * zero third-party sound files (see ASSET_LICENSES.md). If production music
 * files are added under public/audio/, set `useExternalMusic` to true and
 * Howler takes over music playback with the same mood API.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private ambientGain!: GainNode;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private mood: MusicMood = 'silence';
  private musicTimer: number | null = null;
  private beat = 0;
  private useExternalMusic = false;
  private howlTracks = new Map<MusicMood, Howl>();

  private volumes = { master: 0.8, music: 0.7, sfx: 0.9 };

  /** Must be called from a user gesture (title screen button). */
  init(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambientGain.connect(this.master);
    this.applyVolumes();
    this.startAmbient();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music * 0.5;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.ambientGain.gain.value = this.volumes.master * 0.35;
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /* ------------------------------ SFX ------------------------------ */

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
    slideTo?: number
  ): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, peak: number, filterFreq: number, delay = 0): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  private noiseCache: AudioBuffer | null = null;
  private noiseBuffer(): AudioBuffer {
    if (this.noiseCache) return this.noiseCache;
    const ctx = this.ctx as AudioContext;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseCache = buf;
    return buf;
  }

  playSfx(name: SfxName): void {
    if (!this.ctx) return;
    switch (name) {
      case 'ui':
        this.tone(660, 0.08, 'sine', 0.12);
        break;
      case 'pickup':
        this.tone(523, 0.09, 'triangle', 0.16);
        this.tone(784, 0.12, 'triangle', 0.14, 0.07);
        break;
      case 'gather':
        this.noiseBurst(0.16, 0.2, 900);
        this.tone(392, 0.1, 'triangle', 0.08, 0.03);
        break;
      case 'craft':
        this.tone(440, 0.1, 'triangle', 0.13);
        this.tone(554, 0.1, 'triangle', 0.13, 0.11);
        this.tone(659, 0.18, 'triangle', 0.15, 0.22);
        break;
      case 'chime':
        this.tone(880, 1.2, 'sine', 0.14);
        this.tone(1318, 1.4, 'sine', 0.08, 0.05);
        this.tone(1760, 1.6, 'sine', 0.05, 0.1);
        break;
      case 'quest':
        this.tone(523, 0.12, 'triangle', 0.14);
        this.tone(659, 0.12, 'triangle', 0.14, 0.12);
        this.tone(784, 0.28, 'triangle', 0.16, 0.24);
        break;
      case 'success':
        this.tone(587, 0.1, 'triangle', 0.15);
        this.tone(880, 0.3, 'triangle', 0.16, 0.1);
        break;
      case 'fail':
        this.tone(330, 0.2, 'sine', 0.13, 0, 220);
        break;
      case 'splash':
        this.noiseBurst(0.35, 0.22, 1400);
        break;
      case 'bite':
        this.tone(988, 0.06, 'square', 0.09);
        this.tone(988, 0.06, 'square', 0.09, 0.09);
        break;
      case 'dialogue':
        this.tone(500 + Math.random() * 300, 0.05, 'sine', 0.06);
        break;
      case 'emote':
        this.tone(1046, 0.1, 'sine', 0.1);
        this.tone(1568, 0.16, 'sine', 0.08, 0.08);
        break;
      case 'place':
        this.noiseBurst(0.1, 0.14, 600);
        this.tone(294, 0.1, 'sine', 0.1, 0.02);
        break;
      case 'footstep_grass':
        this.noiseBurst(0.07, 0.05, 500);
        break;
      case 'footstep_stone':
        this.noiseBurst(0.06, 0.07, 1200);
        break;
    }
  }

  /* ----------------------------- Music ----------------------------- */

  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.useExternalMusic) {
      this.crossfadeHowl(mood);
      return;
    }
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (mood === 'silence' || !this.ctx) return;
    this.beat = 0;
    const tempoMs = mood === 'rain' ? 900 : mood === 'night' ? 820 : 640;
    this.musicTimer = window.setInterval(() => this.scheduleBeat(), tempoMs);
  }

  private scheduleBeat(): void {
    if (!this.ctx) return;
    // Generative motif built on traditional Japanese pentatonic modes, so the
    // score reads as koto/shakuhachi rather than generic Western pentatonic.
    // Equal temperament, A4 = 440.
    const scales: Record<string, number[]> = {
      // Yo (陽) — bright, hemitonic-free; the mode of folk song and warabe uta.
      // D E G A C D
      village: [293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
      // Kumoi (雲井) — open but wistful. D E F A B D
      valley: [293.66, 329.63, 349.23, 440.0, 493.88, 587.33],
      // Hirajoshi (平調子) — the classic koto tuning, dark and still. A B C E F A
      night: [220.0, 246.94, 261.63, 329.63, 349.23, 440.0],
      // In (陰) / Sakura — the semitone from 1 to b2 gives it the melancholy.
      // D Eb G A Bb D
      rain: [293.66, 311.13, 392.0, 440.0, 466.16, 587.33],
    };
    const scale = scales[this.mood] ?? scales.village;
    this.beat++;
    if (this.beat % 2 === 1) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      this.musicPluck(note, 0.09);
      // A fourth above rings closer to koto harmony than the old fifth did.
      if (Math.random() < 0.3) this.musicPluck(note * 1.3348, 0.05, 0.16);
    }
    if (this.beat % 8 === 0) this.musicPluck(scale[0] / 2, 0.07, 0, 2.2);
  }

  private musicPluck(freq: number, peak: number, delay = 0, dur = 1.1): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  private crossfadeHowl(mood: MusicMood): void {
    this.howlTracks.forEach((h) => h.fade(h.volume(), 0, 1200));
    if (mood === 'silence') return;
    let track = this.howlTracks.get(mood);
    if (!track) {
      track = new Howl({ src: [`audio/music_${mood}.mp3`], loop: true, volume: 0 });
      this.howlTracks.set(mood, track);
    }
    track.play();
    track.fade(0, this.volumes.music, 1500);
  }

  /* ---------------------------- Ambient ---------------------------- */

  private startAmbient(): void {
    if (!this.ctx) return;
    // Wind: looped noise through a slowly wandering lowpass filter.
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer();
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(windFilter).connect(this.windGain).connect(this.ambientGain);
    wind.start();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();

    // Rain layer, silent until weather turns.
    const rain = this.ctx.createBufferSource();
    rain.buffer = this.noiseBuffer();
    rain.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1800;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainFilter).connect(this.rainGain).connect(this.ambientGain);
    rain.start();
  }

  setWind(strength: number): void {
    if (this.windGain && this.ctx)
      this.windGain.gain.linearRampToValueAtTime(0.03 + strength * 0.12, this.ctx.currentTime + 2);
  }

  setRain(strength: number): void {
    if (this.rainGain && this.ctx)
      this.rainGain.gain.linearRampToValueAtTime(strength * 0.09, this.ctx.currentTime + 2);
  }
}
