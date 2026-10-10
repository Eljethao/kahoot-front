import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LeaderboardEntry } from '../../types';
import { cn } from '../../lib/utils';
import { AnimatedNumber } from './AnimatedNumber';
import { Avatar } from './Avatar';

// How long the old standings stay up before players slide to their new places.
const REORDER_DELAY_MS = 1400;

// The top players. With `reorder`, it first shows the standings from before the
// last question, then slides everyone to their new place while scores count up.
export const Scoreboard: React.FC<{
    entries: LeaderboardEntry[];
    reorder?: boolean;
    onReorder?: () => void;
    className?: string;
}> = ({ entries, reorder = false, onReorder, className }) => {
    const [settled, setSettled] = useState(!reorder);
    const onReorderRef = useRef(onReorder);

    useEffect(() => {
        onReorderRef.current = onReorder;
    }, [onReorder]);

    useEffect(() => {
        if (!reorder) return;
        const timer = setTimeout(() => {
            setSettled(true);
            onReorderRef.current?.();
        }, REORDER_DELAY_MS);
        return () => clearTimeout(timer);
    }, [reorder]);

    const ordered = [...entries].sort((a, b) => (settled ? a.rank - b.rank : a.previousRank - b.previousRank));

    return (
        <ol className={cn('w-full max-w-3xl space-y-3', className)}>
            {ordered.map((entry, index) => {
                const rank = settled ? entry.rank : entry.previousRank;
                const moved = entry.previousRank - entry.rank;
                const leader = settled && entry.rank === 1;
                return (
                    <motion.li
                        key={entry.playerName}
                        layout
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                            layout: { type: 'spring', stiffness: 220, damping: 26 },
                            delay: settled && !reorder ? index * 0.08 : index * 0.06,
                        }}
                        className={cn(
                            'flex items-center gap-3 sm:gap-4 rounded-2xl bg-white px-4 sm:px-5 py-3 sm:py-4 text-slate-900 shadow-lg shadow-black/20',
                            leader && 'ring-4 ring-gold',
                        )}
                    >
                        <span
                            className={cn(
                                'tabular w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg font-extrabold',
                                leader ? 'bg-gold text-amber-950' : 'bg-slate-100 text-slate-600',
                            )}
                        >
                            {rank}
                        </span>
                        <Avatar avatar={entry.avatar} className="h-10 w-10 text-3xl leading-none" />
                        <span className="flex-1 min-w-0 truncate text-lg sm:text-xl font-bold">{entry.playerName}</span>

                        {settled && reorder && moved !== 0 && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    'hidden sm:inline-flex items-center text-sm font-bold rounded-full px-2 py-0.5',
                                    moved > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                                )}
                            >
                                {moved > 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {Math.abs(moved)}
                            </motion.span>
                        )}
                        {entry.streak >= 2 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-sm font-bold text-orange-700">
                                🔥{entry.streak}
                            </span>
                        )}
                        {reorder && entry.lastPoints > 0 && (
                            <motion.span
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.06 }}
                                className="hidden sm:inline tabular text-sm font-bold text-emerald-600"
                            >
                                +{entry.lastPoints.toLocaleString()}
                            </motion.span>
                        )}
                        <AnimatedNumber
                            value={settled ? entry.totalPoints : entry.totalPoints - entry.lastPoints}
                            duration={1.2}
                            className="w-24 text-right text-xl sm:text-2xl font-extrabold"
                        />
                    </motion.li>
                );
            })}
        </ol>
    );
};
