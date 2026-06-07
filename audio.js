const AUDIO_PATHS = {
  music: 'assets/audio/rule-beast-drone-loop.mp3',
  puzzle: 'assets/audio/puzzle-solve-sigil.mp3',
  kill: 'assets/audio/monster-kill-growl.mp3',
  round: 'assets/audio/round-rule-alarm.mp3'
};

export class AudioSystem {
  constructor() {
    this.enabled = false;
    this.muted = false;
    this.music = new Audio(AUDIO_PATHS.music);
    this.music.loop = true;
    this.music.volume = 0.28;
    this.sfx = new Map(Object.entries(AUDIO_PATHS).filter(([key]) => key !== 'music').map(([key, path]) => {
      const audio = new Audio(path);
      audio.volume = key === 'kill' ? 0.75 : 0.55;
      return [key, audio];
    }));
  }

  async unlock() {
    if (this.enabled) return;
    this.enabled = true;
    if (!this.muted) {
      try { await this.music.play(); } catch { /* User gesture may still be pending. */ }
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.music.muted = muted;
    this.sfx.forEach((audio) => { audio.muted = muted; });
    if (muted) this.music.pause();
    else if (this.enabled) this.music.play().catch(() => {});
  }

  play(name) {
    if (!this.enabled || this.muted) return;
    const audio = this.sfx.get(name);
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  heartbeat(intensity) {
    if (!this.enabled || this.muted) return;
    const now = performance.now();
    if (this.nextHeartbeat && now < this.nextHeartbeat) return;
    const beat = new AudioContext();
    const osc = beat.createOscillator();
    const gain = beat.createGain();
    osc.type = 'sine';
    osc.frequency.value = 48;
    gain.gain.setValueAtTime(0.0001, beat.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045 * intensity, beat.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, beat.currentTime + 0.18);
    osc.connect(gain).connect(beat.destination);
    osc.start();
    osc.stop(beat.currentTime + 0.2);
    this.nextHeartbeat = now + Math.max(260, 950 - intensity * 580);
    setTimeout(() => beat.close(), 300);
  }
}
