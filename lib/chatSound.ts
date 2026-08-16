// A short two-note "ping" synthesized with the Web Audio API rather than an external audio
// file - no asset to source/license, no network request, works the same everywhere. One
// shared AudioContext, created lazily on first use since browsers refuse to start one before
// a user gesture has happened somewhere on the page (which, by the time a message arrives,
// has always already happened - the admin had to click into the app to begin with).
let audioContext: AudioContext | null = null;

export function playMessageReceivedSound() {
  try {
    audioContext ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    [880, 1108.73].forEach((frequency, i) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  } catch {
    // Audio is a nice-to-have, never worth surfacing an error over.
  }
}
