import { useSyncExternalStore } from 'react';
import { sound } from '../lib/sound';

const snapshot = () => `${sound.isMuted() ? 1 : 0}${sound.isReady() ? 1 : 0}`;

// Whether sound is muted, and whether the browser has allowed audio yet.
export function useSoundState() {
    const state = useSyncExternalStore(sound.subscribe, snapshot);
    return { muted: state[0] === '1', ready: state[1] === '1' };
}
