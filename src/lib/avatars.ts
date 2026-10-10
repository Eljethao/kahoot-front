import { createAvatar, type Style } from '@dicebear/core';
import { bigSmile, bottts, funEmoji, personas } from '@dicebear/collection';

// Avatars are DiceBear drawings stored as "<style>:<seed>"; the same seed always
// draws the same picture. set_avatar in the database accepts only these style keys.
// Players from before the picker have an emoji instead, which is shown as text.
export const AVATAR_STYLES = [
    { key: 'fun-emoji', label: 'Emoji', style: funEmoji },
    { key: 'personas', label: 'People', style: personas },
    { key: 'big-smile', label: 'Smiles', style: bigSmile },
    { key: 'bottts', label: 'Robots', style: bottts },
] as const;

export type AvatarStyleKey = (typeof AVATAR_STYLES)[number]['key'];

const BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c1f0c1'];
const SEED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const toAvatar = (styleKey: AvatarStyleKey, seed: string) => `${styleKey}:${seed}`;

export function parseAvatar(avatar: string): { styleKey: AvatarStyleKey; seed: string } | null {
    const [key, seed] = avatar.split(':');
    const entry = AVATAR_STYLES.find((s) => s.key === key);
    return entry && seed ? { styleKey: entry.key, seed } : null;
}

export function randomSeed(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (b) => SEED_CHARS[b % SEED_CHARS.length]).join('');
}

// Drawing an avatar takes a moment, and scoreboards redraw often.
const images = new Map<string, string | null>();

// A data: URI for the avatar's picture, or null if it is an emoji.
export function avatarImage(avatar: string): string | null {
    const cached = images.get(avatar);
    if (cached !== undefined) return cached;

    const parsed = parseAvatar(avatar);
    const entry = parsed && AVATAR_STYLES.find((s) => s.key === parsed.styleKey);
    const image =
        parsed && entry
            ? createAvatar(entry.style as Style<object>, { seed: parsed.seed, backgroundColor: BACKGROUNDS }).toDataUri()
            : null;
    images.set(avatar, image);
    return image;
}
