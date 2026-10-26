// Local audio files used by the game. Playback starts after the player's
// first interaction, in accordance with browser audio autoplay rules.
(() => {
  const effects = {
    chomp: new Audio("./sounds/chomp.wav"),
    power: new Audio("./sounds/power-pellet.wav"),
    ghost: new Audio("./sounds/ghost-eaten.wav"),
    death: new Audio("./sounds/death.wav"),
    fruit: new Audio("./sounds/fruit.wav"),
    level: new Audio("./sounds/level-up.wav"),
    extraLife: new Audio("./sounds/extra-life.wav"),
  };
  const music = new Audio("./sounds/background.wav");
  music.loop = true;
  music.volume = 0.72;
  music.preload = "auto";
  const unavailable = new Set();
  for (const [name, sound] of Object.entries(effects)) {
    sound.volume = 1.0;
    sound.preload = "auto";
    sound.addEventListener("error", () => unavailable.add(name));
    sound.load();
  }
  music.load();

  let audioContext;
  const fallbackNotes = {
    chomp: [520, 0.045], power: [760, 0.18], ghost: [980, 0.22],
    death: [190, 0.32], fruit: [680, 0.16], level: [880, 0.3], extraLife: [1040, 0.24],
  };
  function playFallback(name) {
    const [frequency, duration] = fallbackNotes[name] || [];
    if (!frequency) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      // Audio files still play when Web Audio is unavailable.
    }
  }

  window.PacmanAudio = {
    enabled: true,
    play(name) {
      if (!this.enabled || !effects[name]) return;
      const sound = effects[name];
      if (unavailable.has(name)) {
        playFallback(name);
        return;
      }
      sound.currentTime = 0;
      sound.play().catch(() => playFallback(name));
    },
    startMusic() {
      if (this.enabled && music.paused) music.play().catch(() => {});
    },
    pauseMusic() {
      music.pause();
    },
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.pauseMusic();
    },
  };
})();
