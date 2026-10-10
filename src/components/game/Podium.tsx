import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../../types';
import { cn } from '../../lib/utils';
import { Avatar } from './Avatar';
import { Confetti } from './Confetti';

export type PodiumStep = 'drumroll' | 'third' | 'second' | 'first';

// When each step happens, in seconds from the start.
const TIMELINE: { at: number; step: PodiumStep; drumroll?: number }[] = [
    { at: 0.2, step: 'drumroll', drumroll: 1.4 },
    { at: 1.6, step: 'third' },
    { at: 2.2, step: 'drumroll', drumroll: 1.4 },
    { at: 3.6, step: 'second' },
    { at: 4.2, step: 'drumroll', drumroll: 2.0 },
    { at: 6.2, step: 'first' },
];
const REVEALED_BY: Record<PodiumStep, number> = { drumroll: 0, third: 1, second: 2, first: 3 };

// Spinning light rays behind the champion.
export const Rays: React.FC<{ className?: string }> = ({ className }) => (
    <motion.div
        aria-hidden
        className={cn(
            'pointer-events-none absolute rounded-full bg-[repeating-conic-gradient(rgba(255,215,0,0.35)_0deg_10deg,transparent_10deg_30deg)] [mask-image:radial-gradient(circle,black_30%,transparent_70%)]',
            className,
        )}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
    />
);

const PLACES = [
    { place: 2, height: 'h-32 sm:h-44', block: 'from-slate-200 to-silver text-slate-700', revealAt: 2 },
    { place: 1, height: 'h-44 sm:h-60', block: 'from-amber-300 to-gold text-amber-900', revealAt: 3 },
    { place: 3, height: 'h-24 sm:h-32', block: 'from-orange-300 to-bronze text-orange-950', revealAt: 1 },
];

// 2nd, 1st, 3rd side by side, revealed from 3rd to 1st with a drumroll before
// each. The champion gets a crown, a trophy, light rays and confetti.
export const Podium: React.FC<{ entries: LeaderboardEntry[]; onStep?: (step: PodiumStep, drumroll?: number) => void }> = ({
    entries,
    onStep,
}) => {
    const [revealed, setRevealed] = useState(0);
    const onStepRef = useRef(onStep);

    useEffect(() => {
        onStepRef.current = onStep;
    }, [onStep]);

    useEffect(() => {
        const timers = TIMELINE.map(({ at, step, drumroll }) =>
            setTimeout(() => {
                setRevealed((count) => Math.max(count, REVEALED_BY[step]));
                onStepRef.current?.(step, drumroll);
            }, at * 1000),
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div className="relative flex w-full max-w-4xl items-end justify-center gap-3 sm:gap-5 pt-24">
            {revealed >= 3 && entries[0] && <Confetti />}
            {PLACES.map(({ place, height, block, revealAt }) => {
                const entry = entries[place - 1];
                const shown = revealed >= revealAt && !!entry;
                const champion = place === 1;
                return (
                    <div key={place} className="relative flex flex-1 flex-col items-center">
                        {shown && (
                            <motion.div
                                initial={{ opacity: 0, y: 30, scale: 0.6 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.25 }}
                                className="relative mb-3 flex flex-col items-center text-center"
                            >
                                {champion && (
                                    <>
                                        <Rays className="-top-20 w-72 h-72" />
                                        <motion.div
                                            initial={{ y: -80, rotate: -30, opacity: 0 }}
                                            animate={{ y: [-80, 0, -8, 0], rotate: [-30, 0, 0, 0], opacity: 1 }}
                                            transition={{ duration: 1, delay: 0.6, times: [0, 0.6, 0.8, 1] }}
                                            className="relative z-10 -mb-3"
                                        >
                                            <Crown className="w-14 h-14 text-gold fill-gold drop-shadow-[0_4px_12px_rgba(245,183,0,0.6)]" />
                                        </motion.div>
                                    </>
                                )}
                                <div
                                    className={cn(
                                        'relative z-10 flex items-center justify-center rounded-full bg-white/15 ring-4',
                                        champion ? 'w-24 h-24 sm:w-28 sm:h-28 text-6xl ring-gold' : 'w-16 h-16 sm:w-20 sm:h-20 text-4xl ring-white/30',
                                    )}
                                >
                                    <Avatar avatar={entry.avatar} className="h-full w-full" />
                                </div>
                                {champion && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 1.1 }}
                                        className="relative z-10 mt-3 rounded-full bg-gold px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-amber-950"
                                    >
                                        Champion
                                    </motion.div>
                                )}
                                <div className="relative z-10 mt-2 max-w-full break-all text-lg sm:text-2xl font-extrabold">
                                    {entry.playerName}
                                </div>
                                <div className="relative z-10 tabular text-sm sm:text-base font-semibold text-white/70">
                                    {entry.totalPoints.toLocaleString()} pts
                                </div>
                            </motion.div>
                        )}
                        <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: shown ? 1 : 0.04 }}
                            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
                            style={{ originY: 1 }}
                            className={cn(
                                'flex w-full flex-col items-center justify-start gap-1 rounded-t-2xl bg-gradient-to-b pt-4 shadow-2xl',
                                height,
                                block,
                            )}
                        >
                            {champion ? (
                                <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
                            ) : null}
                            <span className="text-4xl sm:text-6xl font-black">{place}</span>
                        </motion.div>
                    </div>
                );
            })}
        </div>
    );
};
