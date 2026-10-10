// Music and sound effects for the host screen, synthesized with the Web Audio
// API so there are no audio files. Browsers only allow audio once the user has
// interacted with the page, so unlock() is called from input events; music
// asked for before that starts as soon as audio is unlocked.

export type Track = 'lobby' | 'question';

const MUTED_KEY = 'quiz.muted';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
let wantedTrack: Track | null = null;
let playingTrack: Track | null = null;
let musicTimer: number | undefined;
let nextStepTime = 0;
let step = 0;
const listeners = new Set<() => void>();

function readMuted(): boolean {
    try {
        return localStorage.getItem(MUTED_KEY) === '1';
    } catch {
        return false;
    }
}

const notify = () => listeners.forEach((listener) => listener());

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

// The audio context, if sound can play right now.
function live(): AudioContext | null {
    return context && master && context.state === 'running' && !muted ? context : null;
}

interface ToneOptions {
    type?: OscillatorType;
    volume?: number;
    attack?: number;
    slideTo?: number;
    lowpass?: number;
}

function tone(frequency: number, at: number, duration: number, options: ToneOptions = {}) {
    const ctx = live();
    if (!ctx || !master) return;
    const { type = 'sine', volume = 0.3, attack = 0.01, slideTo, lowpass } = options;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    let output: AudioNode = osc;
    if (lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        output = output.connect(filter);
    }
    output.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.05);
}

// One second of white noise, made once and looped.
function whiteNoise(ctx: AudioContext): AudioBuffer {
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function noise(at: number, duration: number, volume: number, filterType: BiquadFilterType, frequency: number) {
    const ctx = live();
    if (!ctx || !master) return;

    const source = ctx.createBufferSource();
    source.buffer = whiteNoise(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + duration + 0.05);
}

// ---------------------------------------------------------------------------
// Music: a 4-bar loop of 16th-note steps, scheduled slightly ahead of time.
// ---------------------------------------------------------------------------

interface TrackSpec {
    bpm: number;
    chords: number[][]; // one chord (MIDI notes) per bar
    play: (step: number, chord: number[], at: number, stepLength: number) => void;
}

const TRACKS: Record<Track, TrackSpec> = {
    // Bright and bouncy: C – Am – F – G.
    lobby: {
        bpm: 112,
        chords: [
            [48, 60, 64, 67],
            [45, 57, 60, 64],
            [41, 57, 60, 65],
            [43, 55, 59, 62],
        ],
        play(s, chord, at, len) {
            const [root, ...notes] = chord;
            const arpeggio = [0, 1, 2, 1, 0, 2, 1, 2];
            if (s % 2 === 0) tone(midi(notes[arpeggio[s / 2]] + 12), at, len * 1.8, { type: 'triangle', volume: 0.07 });
            if (s % 8 === 0) tone(midi(root), at, len * 6, { type: 'sine', volume: 0.16 });
            if (s % 8 === 0) tone(150, at, 0.12, { slideTo: 50, volume: 0.22 });
            if (s % 4 === 2) noise(at, 0.05, 0.03, 'highpass', 7000);
        },
    },
    // Tense countdown pulse: Am – Am – F – E.
    question: {
        bpm: 132,
        chords: [
            [45, 57, 60, 64],
            [45, 57, 60, 64],
            [41, 57, 60, 65],
            [40, 56, 59, 64],
        ],
        play(s, chord, at, len) {
            const [root, ...notes] = chord;
            tone(midi(notes[s % 3] + 12), at, len * 0.9, { type: 'triangle', volume: 0.05 });
            if (s % 4 === 0) tone(midi(root), at, len * 3, { type: 'sawtooth', volume: 0.07, lowpass: 400 });
            if (s % 8 === 4) noise(at, 0.08, 0.05, 'bandpass', 1800);
            if (s % 2 === 1) noise(at, 0.03, 0.02, 'highpass', 8000);
        },
    },
};

function scheduleMusic() {
    const ctx = live();
    if (!ctx || !playingTrack) return;
    const spec = TRACKS[playingTrack];
    const stepLength = 60 / spec.bpm / 4;
    while (nextStepTime < ctx.currentTime + 0.15) {
        const s = step % 16;
        spec.play(s, spec.chords[Math.floor(step / 16) % spec.chords.length], nextStepTime, stepLength);
        nextStepTime += stepLength;
        step = (step + 1) % (16 * spec.chords.length);
    }
}

// Starts or stops the loop so that it matches wantedTrack.
function syncMusic() {
    const ctx = live();
    const target = ctx ? wantedTrack : null;
    if (target === playingTrack) return;

    window.clearInterval(musicTimer);
    musicTimer = undefined;
    playingTrack = target;
    if (!ctx || !target) return;

    step = 0;
    nextStepTime = ctx.currentTime + 0.05;
    scheduleMusic();
    musicTimer = window.setInterval(scheduleMusic, 40);
}

export const sound = {
    // Call from a user gesture (or once the page has had one).
    unlock() {
        if (!context) {
            try {
                context = new AudioContext();
            } catch {
                return;
            }
            master = context.createGain();
            master.gain.value = 0.8;
            master.connect(context.destination);
            context.onstatechange = () => {
                syncMusic();
                notify();
            };
        }
        if (context.state === 'suspended') void context.resume().catch(() => undefined);
    },

    isMuted: () => muted,
    isReady: () => context?.state === 'running',

    setMuted(value: boolean) {
        muted = value;
        try {
            localStorage.setItem(MUTED_KEY, value ? '1' : '0');
        } catch {
            // Not remembered, but still applies now.
        }
        syncMusic();
        notify();
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    // The background loop to play, or null for silence.
    music(track: Track | null) {
        wantedTrack = track;
        syncMusic();
    },

    // A player joined.
    pop() {
        const at = live()?.currentTime;
        if (at === undefined) return;
        tone(520, at, 0.14, { slideTo: 1040, volume: 0.2 });
    },

    // One second passing near the end of a question.
    tick(urgent = false) {
        const at = live()?.currentTime;
        if (at === undefined) return;
        tone(urgent ? 1560 : 1180, at, 0.06, { type: 'square', volume: urgent ? 0.09 : 0.05, lowpass: 3000 });
    },

    // Time is up.
    gong() {
        const at = live()?.currentTime;
        if (at === undefined) return;
        [98, 147, 196, 294].forEach((f, i) => tone(f, at, 2.4 - i * 0.3, { type: 'triangle', volume: 0.22 / (i + 1) }));
        noise(at, 0.4, 0.08, 'lowpass', 900);
    },

    // A screen change: a question appears, the scoreboard slides in.
    whoosh() {
        const ctx = live();
        if (!ctx || !master) return;
        const at = ctx.currentTime;
        const source = ctx.createBufferSource();
        source.buffer = whiteNoise(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 1.2;
        filter.frequency.setValueAtTime(400, at);
        filter.frequency.exponentialRampToValueAtTime(3200, at + 0.35);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.18, at + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        source.connect(filter).connect(gain).connect(master);
        source.start(at);
        source.stop(at + 0.5);
    },

    // The correct answers are shown.
    reveal() {
        const at = live()?.currentTime;
        if (at === undefined) return;
        [72, 76, 79, 84].forEach((n, i) => tone(midi(n), at + i * 0.08, 0.5, { type: 'triangle', volume: 0.14 }));
    },

    // Builds tension before a podium place is revealed.
    drumroll(seconds: number) {
        const at = live()?.currentTime;
        if (at === undefined) return;
        const hits = Math.floor(seconds / 0.05);
        for (let i = 0; i < hits; i++) noise(at + i * 0.05, 0.06, 0.03 + (0.09 * i) / hits, 'bandpass', 1800);
    },

    // A podium place is revealed.
    cymbal() {
        const at = live()?.currentTime;
        if (at === undefined) return;
        noise(at, 1.4, 0.16, 'highpass', 5000);
        tone(midi(55), at, 0.6, { type: 'sawtooth', volume: 0.08, lowpass: 1500 });
    },

    // The champion is revealed.
    fanfare() {
        const at = live()?.currentTime;
        if (at === undefined) return;
        const brass = { type: 'sawtooth' as const, volume: 0.1, lowpass: 2200, attack: 0.03 };
        [67, 67, 67].forEach((n, i) => tone(midi(n), at + i * 0.13, 0.12, brass));
        [60, 64, 67, 72].forEach((n) => tone(midi(n), at + 0.42, 1.6, brass));
        tone(midi(48), at + 0.42, 1.6, { type: 'triangle', volume: 0.2 });
        noise(at + 0.42, 1.8, 0.12, 'highpass', 6000);
    },
};
