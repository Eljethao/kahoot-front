import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Play, Users, X, Zap } from 'lucide-react';
import type { LobbyPlayer, QuestionPayload, QuestionResults } from '../../types';
import { ANSWER_COLORS } from '../../lib/answerStyles';
import { cn } from '../../lib/utils';
import { AnswerShape } from '../../components/game/AnswerShape';
import { Avatar } from '../../components/game/Avatar';
import { Button } from '../../components/ui/Button';

const formatPin = (pin: string) => `${pin.slice(0, 3)} ${pin.slice(3)}`;

// "Double points" / "No points" for questions that aren't worth the standard 1000.
export const PointsBadge: React.FC<{ points: number; className?: string }> = ({ points, className }) => {
    if (points === 1000) return null;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-extrabold uppercase tracking-wider',
                points > 1000 ? 'bg-gold text-amber-950' : 'bg-white/15 text-white',
                className,
            )}
        >
            <Zap className="w-4 h-4" />
            {points > 1000 ? `${points / 1000}× points` : points === 0 ? 'No points' : `${points} points`}
        </span>
    );
};

export const HostLobby: React.FC<{
    pin: string;
    players: LobbyPlayer[];
    busy: boolean;
    onStart: () => void;
    onKick: (playerName: string) => void;
}> = ({ pin, players, busy, onStart, onKick }) => {
    const joinUrl = `${window.location.origin}/play?pin=${pin}`;

    return (
        <div className="flex-1 flex flex-col items-center px-4 sm:px-8 pb-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 w-full max-w-5xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl shadow-black/30 flex flex-col md:flex-row"
            >
                <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center">
                    <p className="text-lg font-semibold text-slate-500">
                        Join at <span className="font-bold text-slate-900">{window.location.host}/play</span>
                    </p>
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Game PIN</p>
                    <p className="tabular text-6xl sm:text-8xl font-black tracking-wide text-game-900">{formatPin(pin)}</p>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 bg-slate-50 p-6">
                    <QRCodeSVG value={joinUrl} size={164} fgColor="#2e0e63" bgColor="transparent" />
                    <p className="text-sm font-semibold text-slate-500">Scan to join</p>
                </div>
            </motion.div>

            <div className="mt-8 w-full max-w-5xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-lg font-bold">
                    <Users className="w-5 h-5" />
                    <span className="tabular">{players.length}</span>
                    {players.length === 1 ? 'player' : 'players'}
                </div>
                <Button variant="light" size="xl" onClick={onStart} disabled={players.length === 0 || busy}>
                    Start <Play className="w-5 h-5 fill-current" />
                </Button>
            </div>

            <div className="mt-6 w-full max-w-5xl flex-1">
                {players.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-3 text-white/50">
                        <motion.div
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="text-5xl"
                        >
                            👀
                        </motion.div>
                        <p className="text-xl font-semibold">Waiting for players to join…</p>
                    </div>
                ) : (
                    <>
                        <ul className="flex flex-wrap justify-center gap-3">
                            <AnimatePresence>
                                {players.map((player) => (
                                    <motion.li
                                        key={player.name}
                                        layout
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                    >
                                        <button
                                            onClick={() => onKick(player.name)}
                                            title={`Remove ${player.name}`}
                                            className="group flex items-center gap-2 rounded-full bg-white/10 py-2 pl-2 pr-4 text-lg font-bold transition-colors hover:bg-rose-500/90 cursor-pointer"
                                        >
                                            <Avatar avatar={player.avatar} className="h-9 w-9 bg-white/15 text-2xl" />
                                            {player.name}
                                            <X className="w-4 h-4 -ml-1 opacity-0 transition-opacity group-hover:opacity-100" />
                                        </button>
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                        <p className="mt-6 text-center text-sm text-white/40">Click a player to remove them</p>
                    </>
                )}
            </div>
        </div>
    );
};

// The question on its own for a few seconds, before answers open.
export const HostQuestionIntro: React.FC<{ question: QuestionPayload; secondsLeft: number }> = ({ question, secondsLeft }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center">
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-bold uppercase tracking-[0.2em] text-white/80"
        >
            Question {question.questionNumber} of {question.totalQuestions}
        </motion.div>
        <PointsBadge points={question.question.points} className="mt-4" />
        <motion.h1
            key={question.question.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="mt-8 max-w-5xl text-4xl sm:text-6xl font-extrabold leading-tight text-balance"
        >
            {question.question.questionText}
        </motion.h1>
        <div className="mt-14 flex h-24 w-24 items-center justify-center rounded-full bg-white text-game-900">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={secondsLeft}
                    initial={{ scale: 1.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    className="tabular text-5xl font-black"
                >
                    {secondsLeft}
                </motion.span>
            </AnimatePresence>
        </div>
    </div>
);

const TimerRing: React.FC<{ secondsLeft: number; total: number }> = ({ secondsLeft, total }) => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const fraction = total > 0 ? Math.min(1, secondsLeft / total) : 0;
    const urgent = secondsLeft <= 5;

    return (
        <div className="relative h-28 w-28 sm:h-36 sm:w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={radius} fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={urgent ? '#ff4d6d' : 'white'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - fraction)}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                />
            </svg>
            <motion.div
                key={urgent ? secondsLeft : 'calm'}
                initial={urgent ? { scale: 1.3 } : false}
                animate={{ scale: 1 }}
                className="tabular absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl font-black"
            >
                {secondsLeft}
            </motion.div>
        </div>
    );
};

const QuestionCard: React.FC<{ text: string; small?: boolean }> = ({ text, small }) => (
    <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl rounded-2xl bg-white px-6 py-5 text-center text-slate-900 shadow-xl shadow-black/20"
    >
        <h1 className={cn('font-extrabold leading-snug text-balance', small ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl')}>
            {text}
        </h1>
    </motion.div>
);

export const HostQuestionLive: React.FC<{
    question: QuestionPayload;
    secondsLeft: number;
    answeredCount: number;
    totalPlayers: number;
}> = ({ question, secondsLeft, answeredCount, totalPlayers }) => (
    <div className="flex-1 flex flex-col gap-6 px-4 sm:px-8 pb-6">
        <QuestionCard text={question.question.questionText} />

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-between gap-4">
            <TimerRing secondsLeft={secondsLeft} total={question.question.timeLimit} />
            <PointsBadge points={question.question.points} />
            <div className="min-w-28 rounded-2xl bg-white/10 px-6 py-4 text-center">
                <div className="tabular text-4xl sm:text-5xl font-black">
                    {answeredCount}
                    <span className="text-2xl text-white/40">/{totalPlayers}</span>
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-white/60">Answers</div>
            </div>
        </div>

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {question.question.answers.map((answer, index) => (
                <motion.div
                    key={answer.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }}
                    className={cn('flex items-center gap-4 rounded-2xl px-6 py-6 sm:py-8 shadow-lg shadow-black/20', ANSWER_COLORS[index])}
                >
                    <AnswerShape index={index} className="h-9 w-9 shrink-0 text-white" />
                    <span className="text-2xl sm:text-3xl font-bold leading-tight">{answer.answerText}</span>
                </motion.div>
            ))}
        </div>
    </div>
);

const MAX_BAR_PX = 180;

// How many players picked each answer, with the correct ones marked.
export const HostAnswerResults: React.FC<{
    question: QuestionPayload;
    results: QuestionResults;
    busy: boolean;
    isLastQuestion: boolean;
    onNext: () => void;
}> = ({ question, results, busy, isLastQuestion, onNext }) => {
    const countFor = (answerId: string) => results.answerCounts.find((c) => c.answerId === answerId)?.count ?? 0;
    const maxCount = Math.max(1, ...results.answerCounts.map((c) => c.count));

    return (
        <div className="flex-1 flex flex-col gap-6 px-4 sm:px-8 pb-6">
            <QuestionCard text={question.question.questionText} small />

            <div className="mx-auto flex w-full max-w-4xl flex-1 items-end justify-center gap-4 sm:gap-8">
                {question.question.answers.map((answer, index) => {
                    const count = countFor(answer.id);
                    const correct = results.correctAnswerIds.includes(answer.id);
                    return (
                        <div key={answer.id} className="flex w-20 sm:w-32 flex-col items-center justify-end">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 + index * 0.1 }}
                                className="mb-2 flex items-center gap-1 text-3xl font-black tabular"
                            >
                                {count}
                                {correct && <Check className="h-7 w-7" strokeWidth={4} />}
                            </motion.div>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: Math.max(6, (count / maxCount) * MAX_BAR_PX) }}
                                transition={{ duration: 0.7, delay: index * 0.1, ease: 'easeOut' }}
                                className={cn('w-full rounded-t-xl', ANSWER_COLORS[index], !correct && 'opacity-35')}
                            />
                            <div className={cn('flex w-full items-center justify-center rounded-b-xl py-2', ANSWER_COLORS[index], !correct && 'opacity-35')}>
                                <AnswerShape index={index} className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-2">
                {question.question.answers.map((answer, index) => {
                    const correct = results.correctAnswerIds.includes(answer.id);
                    return (
                        <motion.div
                            key={answer.id}
                            animate={{ opacity: correct ? 1 : 0.35, scale: correct ? 1 : 0.98 }}
                            transition={{ delay: 0.8 }}
                            className={cn('flex items-center gap-4 rounded-2xl px-5 py-4 shadow-lg shadow-black/20', ANSWER_COLORS[index])}
                        >
                            <AnswerShape index={index} className="h-7 w-7 shrink-0 text-white" />
                            <span className="flex-1 text-xl sm:text-2xl font-bold">{answer.answerText}</span>
                            {correct ? <Check className="h-8 w-8" strokeWidth={4} /> : <X className="h-7 w-7" strokeWidth={4} />}
                        </motion.div>
                    );
                })}
            </div>

            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
                <div className="text-lg font-semibold text-white/60">
                    {results.answeredCount} of {results.totalPlayers} answered
                </div>
                <Button variant="light" size="lg" onClick={onNext} disabled={busy}>
                    {isLastQuestion ? 'Final results' : 'Scoreboard'} <ArrowRight className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};
