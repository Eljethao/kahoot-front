// Remembers which game this browser joined, so a player who reloads or whose
// phone sleeps goes straight back into the game. Storage can be unavailable
// (private browsing), in which case resuming just doesn't happen.

const KEY = 'quiz.player';

export interface SavedPlayer {
    token: string;
    pin: string;
    sessionId: string;
}

export const playerSession = {
    load(): SavedPlayer | null {
        try {
            const raw = localStorage.getItem(KEY);
            return raw ? (JSON.parse(raw) as SavedPlayer) : null;
        } catch {
            return null;
        }
    },

    save(player: SavedPlayer) {
        try {
            localStorage.setItem(KEY, JSON.stringify(player));
        } catch {
            // Resume won't work, but the game still does.
        }
    },

    clear() {
        try {
            localStorage.removeItem(KEY);
        } catch {
            // Nothing to clear.
        }
    },
};
