import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Clock, Medal, Shuffle, Trophy, X } from 'lucide-react';
import type { LeaderboardEntry, PlayerResult, PlayerStanding, PlayerSummary } from '../../types';
import { ANSWER_COLORS } from '../../lib/answerStyles';
import { AVATAR_STYLES, type AvatarStyleKey, parseAvatar, randomSeed, toAvatar } from '../../lib/avatars';
import { cn, ordinal } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { AnswerShape } from '../../components/game/AnswerShape';
import { AnimatedNumber } from '../../components/game/AnimatedNumber';
import { Avatar } from '../../components/game/Avatar';
import { Confetti } from '../../components/game/Confetti';
import { Rays } from '../../components/game/Podium';

// The bonus flags that make up a player's points for one question.
const BonusFlags: React.FC<{ result: PlayerResult }> = ({ result }) => {
    const flags = [
        { show: result.basePoints > 0, icon: '✅', label: 'Correct answer', points: result.basePoints },
        { show: result.speedBonus > 0, icon: '⚡', label: 'Speed bonus', points: result.speedBonus },
        {
            show: result.streakBonus > 0,
            icon: '🔥',
            label: `Answer streak ×${result.streak}`,
            points: result.streakBonus,
        },
        { show: result.firstBonus > 0, icon: '🥇', label: 'First correct answer', points: result.firstBonus },
    ].filter((flag) => flag.show);

    if (flags.length === 0) return null;

    return (
        <ul className="mt-6 w-full max-w-xs space-y-2">
            {flags.map((flag, index) => (
                <motion.li
                    key={flag.label}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.18, type: 'spring', stiffness: 300, damping: 24 }}
                    className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-4 py-2.5 text-left font-semibold"
                >
                    <span className="flex items-center gap-2">
                        <span className="text-lg">{flag.icon}</span>
                        {flag.label}
                    </span>
                    <span className="tabular font-extrabold">+{flag.points}</span>
                </motion.li>
            ))}
        </ul>
    );
};

const StandingLine: React.FC<{ standing: PlayerStanding }> = ({ standing }) => {
    const { rank, previousRank, behind, totalPoints } = standing;
    const moved = previousRank - rank;
    let detail = '';
    if (rank === 1) detail = "You're in the lead!";
    else if (behind && behind.points > 0) detail = `${behind.points.toLocaleString()} points behind ${behind.playerName}`;
    else if (behind) detail = `Tied with ${behind.playerName}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-8 w-full max-w-xs rounded-2xl bg-white px-5 py-4 text-slate-900 shadow-xl"
        >
            <div className="flex items-center justify-between">
                <span className="text-2xl font-extrabold">{ordinal(rank)} place</span>
                {moved !== 0 && (
                    <span
                        className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-sm font-bold',
                            moved > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                        )}
                    >
                        {moved > 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {Math.abs(moved)}
                    </span>
                )}
            </div>
            {detail && <p className="mt-1 text-sm font-medium text-slate-500">{detail}</p>}
            <p className="tabular mt-2 text-sm font-semibold text-slate-400">{totalPoints.toLocaleString()} points total</p>
        </motion.div>
    );
};

export const PlayerResultView: React.FC<{ result: PlayerResult; standing: PlayerStanding | null }> = ({ result, standing }) => {
    const tone = result.isCorrect ? 'bg-emerald-600' : result.answered ? 'bg-rose-600' : 'bg-slate-700';
    const title = result.isCorrect ? 'Correct!' : result.answered ? 'Incorrect' : "Time's up";
    const showCorrectAnswer = !result.isCorrect && result.correctAnswers.length > 0;

    return (
        <div className={cn('flex-1 flex flex-col items-center justify-center px-6 py-10 text-center', tone)}>
            <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl"
            >
                {result.isCorrect ? (
                    <Check className="h-14 w-14 text-emerald-600" strokeWidth={4} />
                ) : result.answered ? (
                    <X className="h-14 w-14 text-rose-600" strokeWidth={4} />
                ) : (
                    <Clock className="h-12 w-12 text-slate-700" strokeWidth={3} />
                )}
            </motion.div>
            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 text-4xl font-extrabold"
            >
                {title}
            </motion.h2>

            {result.isCorrect ? (
                <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="mt-4 rounded-2xl bg-black/25 px-6 py-3 text-3xl font-black"
                >
                    +<AnimatedNumber value={result.pointsEarned} duration={0.9} delay={0.4} />
                </motion.div>
            ) : (
                <p className="mt-3 text-lg font-semibold text-white/80">
                    {result.answered ? 'No points this time.' : 'You ran out of time.'}
                </p>
            )}

            <BonusFlags result={result} />

            {showCorrectAnswer && (
                <div className="mt-6 w-full max-w-xs">
                    <p className="text-sm font-bold uppercase tracking-wider text-white/70">Correct answer</p>
                    {result.correctAnswers.map((answer) => (
                        <div
                            key={answer.index}
                            className={cn('mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-left font-bold', ANSWER_COLORS[answer.index])}
                        >
                            <AnswerShape index={answer.index} className="h-5 w-5 shrink-0 text-white" />
                            {answer.answerText}
                        </div>
                    ))}
                </div>
            )}

            {standing && <StandingLine standing={standing} />}
        </div>
    );
};

const PlacementBadge: React.FC<{ rank: number }> = ({ rank }) => {
    if (rank === 1) {
        return (
            <div className="relative flex h-44 w-44 items-center justify-center">
                <Rays className="inset-[-40%]" />
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                    className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-gold shadow-[0_0_60px_rgba(245,183,0,0.6)]"
                >
                    <Trophy className="h-16 w-16 text-amber-900" />
                </motion.div>
            </div>
        );
    }
    if (rank <= 3) {
        return (
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                className={cn(
                    'flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b shadow-xl',
                    rank === 2 ? 'from-slate-100 to-silver' : 'from-orange-200 to-bronze',
                )}
            >
                <Medal className={cn('h-14 w-14', rank === 2 ? 'text-slate-600' : 'text-orange-900')} />
            </motion.div>
        );
    }
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="tabular flex h-28 w-28 items-center justify-center rounded-full bg-white/15 text-4xl font-black"
        >
            {ordinal(rank)}
        </motion.div>
    );
};

export const PlayerFinishedView: React.FC<{
    playerName: string;
    standing: PlayerStanding | null;
    summary: PlayerSummary | null;
    leaderboard: LeaderboardEntry[];
    onPlayAgain: () => void;
}> = ({ playerName, standing, summary, leaderboard, onPlayAgain }) => {
    const rank = standing?.rank ?? 0;
    const headline = rank === 1 ? 'Champion!' : rank === 2 ? 'Second place!' : rank === 3 ? 'Third place!' : 'Game over';

    return (
        <div className="flex-1 flex flex-col items-center px-6 py-8 text-center">
            {rank === 1 && <Confetti />}
            {rank > 0 && <PlacementBadge rank={rank} />}
            <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn('mt-4 text-4xl font-extrabold', rank === 1 && 'text-gold')}
            >
                {headline}
            </motion.h1>
            {standing && (
                <p className="mt-1 text-lg font-semibold text-white/70">
                    {ordinal(standing.rank)} of {standing.totalPlayers}
                </p>
            )}

            {standing && summary && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2"
                >
                    {[
                        { label: 'Points', value: standing.totalPoints.toLocaleString() },
                        { label: 'Correct', value: `${summary.correctCount}/${summary.totalQuestions}` },
                        { label: 'Best streak', value: summary.bestStreak ? `🔥${summary.bestStreak}` : '–' },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl bg-white/10 px-2 py-3">
                            <div className="tabular text-xl font-extrabold">{stat.value}</div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="mt-6 w-full max-w-sm rounded-2xl bg-white p-4 text-left text-slate-900 shadow-xl"
            >
                <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-400">Top players</h3>
                <ol className="space-y-1">
                    {leaderboard.map((entry) => (
                        <li
                            key={entry.playerName}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2',
                                entry.playerName === playerName && 'bg-brand-50 ring-1 ring-brand-200',
                            )}
                        >
                            <span className="tabular w-5 font-bold text-slate-400">{entry.rank}</span>
                            <Avatar avatar={entry.avatar} className="h-8 w-8 text-xl" />
                            <span className="flex-1 truncate font-semibold">{entry.playerName}</span>
                            <span className="tabular font-bold">{entry.totalPoints.toLocaleString()}</span>
                        </li>
                    ))}
                </ol>
            </motion.div>

            <button
                onClick={onPlayAgain}
                className="mt-8 rounded-xl bg-white px-6 py-3 font-bold text-game-900 shadow-lg transition-colors hover:bg-white/90 cursor-pointer"
            >
                Join another game
            </button>
        </div>
    );
};

// Lines shown while waiting for the question to end.
const WAITING_LINES = ['Fingers crossed…', 'Were you tricked?', 'Speedy!', 'Lightning fast', 'Waiting for the others…'];

export const PlayerAnsweredView: React.FC<{ selectedIndex: number; error: string; questionId: string }> = ({
    selectedIndex,
    error,
    questionId,
}) => {
    // A different line per question, stable while this one is shown.
    const line = WAITING_LINES[[...questionId].reduce((sum, c) => sum + c.charCodeAt(0), 0) % WAITING_LINES.length];

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            {selectedIndex >= 0 && (
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn('flex h-28 w-28 items-center justify-center rounded-3xl shadow-xl', ANSWER_COLORS[selectedIndex])}
                >
                    <AnswerShape index={selectedIndex} className="h-14 w-14 text-white" />
                </motion.div>
            )}
            {error ? (
                <h2 className="mt-8 text-2xl font-bold">{error}</h2>
            ) : (
                <>
                    <h2 className="mt-8 text-3xl font-extrabold">{line}</h2>
                    <div className="mt-6 flex gap-2">
                        {[0, 1, 2].map((i) => (
                            <motion.span
                                key={i}
                                className="h-3 w-3 rounded-full bg-white/70"
                                animate={{ y: [0, -8, 0] }}
                                transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export const PlayerIntroView: React.FC<{
    questionNumber: number;
    totalQuestions: number;
    questionText: string;
    points: number;
    secondsLeft: number;
}> = ({ questionNumber, totalQuestions, questionText, points, secondsLeft }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">
            Question {questionNumber} of {totalQuestions}
        </p>
        {points > 1000 && (
            <span className="mt-3 rounded-full bg-gold px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-950">
                {points / 1000}× points
            </span>
        )}
        <h1 className="mt-6 text-3xl font-extrabold leading-tight text-balance">{questionText}</h1>
        <p className="mt-10 font-semibold text-white/70">Get ready!</p>
        <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-white text-game-900">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={secondsLeft}
                    initial={{ scale: 1.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    className="tabular text-4xl font-black"
                >
                    {secondsLeft}
                </motion.span>
            </AnimatePresence>
        </div>
    </div>
);

const AVATAR_CHOICES = 12;
const newSeeds = () => Array.from({ length: AVATAR_CHOICES }, randomSeed);

// Shown right after joining (and when the player taps their avatar in the lobby).
// The choices are the same seeds drawn in the chosen style, so switching style
// keeps the selected spot.
export const AvatarPickerView: React.FC<{
    playerName: string;
    avatar: string;
    saving: boolean;
    error: string;
    onConfirm: (avatar: string) => void;
}> = ({ playerName, avatar, saving, error, onConfirm }) => {
    // Start from the player's current avatar, if it is one the picker can draw.
    const [initial] = useState(() => {
        const current = parseAvatar(avatar);
        const seeds = newSeeds();
        if (current) seeds[0] = current.seed;
        return { styleKey: current?.styleKey ?? AVATAR_STYLES[0].key, seeds };
    });
    const [styleKey, setStyleKey] = useState<AvatarStyleKey>(initial.styleKey);
    const [seeds, setSeeds] = useState(initial.seeds);
    const [selectedSeed, setSelectedSeed] = useState(initial.seeds[0]);
    const selected = toAvatar(styleKey, selectedSeed);

    const shuffle = () => {
        const next = newSeeds();
        setSeeds(next);
        setSelectedSeed(next[0]);
    };

    return (
        <div className="flex-1 flex flex-col items-center px-4 py-6">
            <h2 className="text-2xl font-extrabold">Pick your avatar</h2>
            <p className="mt-1 max-w-full truncate font-semibold text-white/70">{playerName}</p>

            <motion.div
                key={selected}
                initial={{ scale: 0.7, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="mt-5"
            >
                <Avatar avatar={selected} className="h-32 w-32 ring-4 ring-white/30 shadow-xl shadow-black/30" />
            </motion.div>

            <div className="mt-6 flex w-full max-w-sm gap-1 rounded-full bg-black/20 p-1">
                {AVATAR_STYLES.map((style) => (
                    <button
                        key={style.key}
                        onClick={() => setStyleKey(style.key)}
                        className={cn(
                            'flex-1 rounded-full py-2 text-sm font-bold transition-colors cursor-pointer',
                            style.key === styleKey ? 'bg-white text-game-900' : 'text-white/70 hover:text-white',
                        )}
                    >
                        {style.label}
                    </button>
                ))}
            </div>

            <div className="mt-4 grid w-full max-w-sm grid-cols-4 gap-3">
                {seeds.map((seed) => (
                    <motion.button
                        key={seed}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedSeed(seed)}
                        aria-label="Choose this avatar"
                        aria-pressed={seed === selectedSeed}
                        className={cn(
                            'aspect-square rounded-full p-1 transition-all cursor-pointer',
                            seed === selectedSeed ? 'bg-white scale-105' : 'bg-white/10 hover:bg-white/20',
                        )}
                    >
                        <Avatar avatar={toAvatar(styleKey, seed)} className="h-full w-full" />
                    </motion.button>
                ))}
            </div>

            {error && <p className="mt-4 text-center font-semibold text-rose-200">{error}</p>}

            <div className="mt-6 flex w-full max-w-sm gap-3">
                <Button variant="glass" size="lg" onClick={shuffle} disabled={saving} aria-label="Show other avatars">
                    <Shuffle className="h-5 w-5" />
                </Button>
                <Button variant="light" size="lg" onClick={() => onConfirm(selected)} isLoading={saving} className="flex-1 font-extrabold">
                    Let's go!
                </Button>
            </div>
        </div>
    );
};
