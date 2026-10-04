import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { gameService, isNotFound, questionDeadline } from '../../services/gameService';
import { useCountdown } from '../../hooks/useCountdown';
import { ANSWER_COLORS, ANSWER_SHAPES } from '../../lib/answerStyles';
import type { GamePhase, HostState, LeaderboardEntry, QuestionPayload, QuestionResults } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, ArrowRight, Check, X, SkipForward } from 'lucide-react';
import { Button } from '../../components/ui/Button';

// After the countdown hits zero, wait a moment before closing the question so
// answers tapped in the last second still arrive.
const END_GRACE_MS = 1000;

const HostGame: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<HostState | null>(null);
    const [loadError, setLoadError] = useState('');
    const [showScoreboard, setShowScoreboard] = useState(false);
    const [busy, setBusy] = useState(false);
    const { secondsLeft, deadline, start: startCountdown } = useCountdown();

    // Bumped on every state change, so a slow reload can't overwrite newer state.
    const versionRef = useRef(0);
    const phaseRef = useRef<GamePhase | undefined>(undefined);
    const endingRef = useRef(false);

    useEffect(() => {
        phaseRef.current = state?.phase;
    }, [state?.phase]);

    const showQuestion = useCallback(
        (question: QuestionPayload) => {
            versionRef.current++;
            setState((s) => s && { ...s, phase: 'question', question, results: undefined, answeredCount: 0 });
            setShowScoreboard(false);
            startCountdown(questionDeadline(question));
        },
        [startCountdown],
    );

    const showFinished = useCallback(
        (leaderboard: LeaderboardEntry[]) => {
            versionRef.current++;
            setState((s) => s && { ...s, phase: 'finished', leaderboard });
            startCountdown(null);
        },
        [startCountdown],
    );

    // Redraws from the database: first load, reconnects, tab back in view.
    const reload = useCallback(async () => {
        if (!sessionId) return;
        const version = ++versionRef.current;
        try {
            const next = await gameService.getHostState(sessionId);
            if (version !== versionRef.current) return;
            setState(next);
            startCountdown(next.phase === 'question' && next.question ? questionDeadline(next.question) : null);
        } catch (error) {
            if (isNotFound(error)) {
                setLoadError('This game does not exist or belongs to another account.');
            } else {
                console.error('Failed to load game', error);
            }
        }
    }, [sessionId, startCountdown]);

    // Called by the timer, by the last answer, or by Skip. The database
    // ignores repeat calls, so a race between them is harmless.
    const endQuestion = useCallback(async () => {
        if (!sessionId || endingRef.current || phaseRef.current !== 'question') return;
        endingRef.current = true;
        try {
            const results = await gameService.endQuestion(sessionId);
            versionRef.current++;
            setState((s) => s && { ...s, phase: 'results', results, answeredCount: results.answeredCount });
            setShowScoreboard(false);
            startCountdown(null);
        } catch (error) {
            console.error('Failed to end question', error);
        } finally {
            endingRef.current = false;
        }
    }, [sessionId, startCountdown]);

    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        // Listen before loading, so nothing sent in between is missed.
        gameService
            .subscribeAsHost(sessionId, {
                onPlayersChanged: (players) => setState((s) => s && { ...s, players }),
                onAnswerCount: (answeredCount, totalPlayers) => {
                    setState((s) =>
                        s && s.phase === 'question'
                            ? { ...s, answeredCount: Math.max(s.answeredCount, answeredCount) }
                            : s,
                    );
                    if (answeredCount >= totalPlayers) void endQuestion();
                },
                onReconnect: () => void reload(),
            })
            .then((stop) => {
                if (cancelled) {
                    stop();
                    return;
                }
                unsubscribe = stop;
                void reload();
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                console.error('Failed to connect to game', error);
                setLoadError('Could not connect to this game. Check your connection and reload the page.');
            });

        const onVisible = () => {
            if (document.visibilityState === 'visible') void reload();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            unsubscribe?.();
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [sessionId, reload, endQuestion]);

    // Close the question when time is up (also right away after a reload
    // that lands on a question whose time has already run out).
    useEffect(() => {
        if (state?.phase !== 'question' || deadline === null) return;
        const timer = setTimeout(() => void endQuestion(), Math.max(0, deadline + END_GRACE_MS - Date.now()));
        return () => clearTimeout(timer);
    }, [state?.phase, deadline, endQuestion]);

    const runHostAction = async (action: (sessionId: string) => Promise<void>) => {
        if (!sessionId || busy) return;
        setBusy(true);
        try {
            await action(sessionId);
        } catch (error) {
            console.error('Host action failed', error);
            alert(error instanceof Error ? error.message : 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const startGame = () => runHostAction(async (id) => showQuestion(await gameService.startGame(id)));

    const advance = () =>
        runHostAction(async (id) => {
            const next = await gameService.nextQuestion(id);
            if ('finished' in next) showFinished(next.leaderboard);
            else showQuestion(next);
        });

    const cancelGame = () =>
        runHostAction(async (id) => {
            await gameService.endGame(id);
            navigate('/dashboard');
        });

    const endGameEarly = () => {
        if (!window.confirm('End the game now and show the final results?')) return;
        void runHostAction(async (id) => showFinished((await gameService.endGame(id)).leaderboard));
    };

    if (loadError) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-6 p-8 text-center">
                <p className="text-xl">{loadError}</p>
                <Button onClick={() => navigate('/dashboard')} className="bg-white text-slate-900 hover:bg-slate-100">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    if (!state) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    const joinUrl = `${window.location.origin}/play?pin=${state.pin}`;
    const question = state.question;
    const results = state.results;
    const isLastQuestion = !!question && question.questionNumber === question.totalQuestions;
    const totalPlayers = state.players.length;

    return (
        <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative font-sans">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600 blur-[150px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600 blur-[150px]" />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col">
                {state.phase !== 'finished' && (
                    <div className="flex items-center justify-between px-8 pt-6">
                        <div className="text-lg font-bold text-white/80 truncate">{state.quizTitle}</div>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={state.phase === 'lobby' ? cancelGame : endGameEarly}
                            className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                            {state.phase === 'lobby' ? 'Cancel' : 'End game'}
                        </Button>
                    </div>
                )}

                {state.phase === 'lobby' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col md:flex-row items-center gap-8 mb-12"
                        >
                            <div className="bg-white text-slate-900 px-12 py-8 rounded-3xl shadow-2xl shadow-violet-500/20 text-center">
                                <p className="text-lg font-bold text-slate-500 mb-1">
                                    Join at <span className="text-slate-900">{window.location.host}/play</span>
                                </p>
                                <p className="text-xl font-bold text-slate-500 mb-2 uppercase tracking-wider">with Game PIN</p>
                                <div className="text-7xl md:text-8xl font-black tracking-widest font-mono">
                                    {state.pin}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-violet-500/20">
                                <QRCodeSVG value={joinUrl} size={176} />
                                <p className="text-center text-sm font-bold text-slate-500 mt-2">Scan to join</p>
                            </div>
                        </motion.div>

                        <div className="w-full max-w-4xl">
                            <div className="flex items-center justify-between mb-6 px-4">
                                <div className="flex items-center gap-2 text-xl font-medium">
                                    <Users className="w-6 h-6" />
                                    {totalPlayers} Players
                                </div>
                                <Button
                                    size="lg"
                                    onClick={startGame}
                                    disabled={totalPlayers === 0 || busy}
                                    className="text-xl px-12 py-6 rounded-2xl"
                                >
                                    Start Game <Play className="ml-3 w-6 h-6 fill-current" />
                                </Button>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 min-h-[200px]">
                                {totalPlayers === 0 ? (
                                    <div className="h-full flex items-center justify-center text-white/40 text-xl animate-pulse">
                                        Waiting for players to join...
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-4 justify-center">
                                        <AnimatePresence>
                                            {state.players.map((player) => (
                                                <motion.div
                                                    key={player}
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-lg shadow-lg"
                                                >
                                                    {player}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {state.phase === 'question' && question && (
                    <div className="flex-1 flex flex-col p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div className="bg-white/10 px-6 py-3 rounded-full font-bold">
                                {question.questionNumber} / {question.totalQuestions}
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => void endQuestion()}
                                className="text-white/70 hover:text-white hover:bg-white/10"
                            >
                                Skip <SkipForward className="ml-2 w-4 h-4" />
                            </Button>
                        </div>

                        <motion.h2
                            key={question.question.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl md:text-6xl font-bold text-center mb-10 leading-tight max-w-6xl mx-auto"
                        >
                            {question.question.questionText}
                        </motion.h2>

                        <div className="flex items-center justify-between max-w-6xl mx-auto w-full mb-10">
                            <div className="w-28 h-28 rounded-full bg-violet-600 flex items-center justify-center text-5xl font-black shadow-xl shadow-violet-600/40">
                                {secondsLeft}
                            </div>
                            <div className="text-center">
                                <div className="text-5xl font-black">
                                    {state.answeredCount}
                                    <span className="text-white/40"> / {totalPlayers}</span>
                                </div>
                                <div className="text-lg text-white/60 font-medium">Answers</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl mx-auto">
                            {question.question.answers.map((answer, index) => (
                                <motion.div
                                    key={answer.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`p-8 rounded-2xl flex items-center shadow-xl ${ANSWER_COLORS[index]}`}
                                >
                                    <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center text-2xl font-bold mr-6">
                                        {ANSWER_SHAPES[index]}
                                    </div>
                                    <span className="text-3xl font-bold">{answer.answerText}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {state.phase === 'results' && question && results && !showScoreboard && (
                    <div className="flex-1 flex flex-col p-8">
                        <h2 className="text-3xl md:text-5xl font-bold text-center mb-10 leading-tight max-w-6xl mx-auto">
                            {question.question.questionText}
                        </h2>

                        <AnswerChart question={question} results={results} />

                        <div className="mt-auto flex items-center justify-between max-w-6xl mx-auto w-full pt-10">
                            <div className="text-xl text-white/60 font-medium">
                                {results.answeredCount} of {results.totalPlayers} answered
                            </div>
                            <Button
                                onClick={isLastQuestion ? advance : () => setShowScoreboard(true)}
                                disabled={busy}
                                size="lg"
                                className="bg-white text-slate-900 hover:bg-slate-100"
                            >
                                {isLastQuestion ? 'Final Results' : 'Next'} <ArrowRight className="ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {state.phase === 'results' && results && showScoreboard && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <motion.h2
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-5xl font-bold mb-12"
                        >
                            Scoreboard
                        </motion.h2>
                        <ScoreList entries={results.leaderboard} />
                        <Button
                            onClick={advance}
                            disabled={busy}
                            size="lg"
                            className="mt-12 bg-white text-slate-900 hover:bg-slate-100"
                        >
                            Next Question <ArrowRight className="ml-2" />
                        </Button>
                    </div>
                )}

                {state.phase === 'finished' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <motion.h2
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-5xl font-bold mb-2"
                        >
                            {state.quizTitle}
                        </motion.h2>
                        <p className="text-2xl text-white/60 mb-12">Final Results</p>
                        <Podium entries={state.leaderboard ?? []} />
                        <div className="w-full max-w-2xl mt-8">
                            <ScoreList entries={(state.leaderboard ?? []).slice(3)} />
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard')}
                            size="lg"
                            className="mt-12 bg-white text-slate-900 hover:bg-slate-100"
                        >
                            Back to Dashboard
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

// How many players picked each answer, with the correct ones marked.
const AnswerChart: React.FC<{
    question: QuestionPayload;
    results: QuestionResults;
}> = ({ question, results }) => {
    const countFor = (answerId: string) => results.answerCounts.find((c) => c.answerId === answerId)?.count ?? 0;
    const maxCount = Math.max(1, ...results.answerCounts.map((c) => c.count));

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-end justify-center gap-6 h-64 mb-8">
                {question.question.answers.map((answer, index) => {
                    const count = countFor(answer.id);
                    const correct = results.correctAnswerIds.includes(answer.id);
                    return (
                        <div key={answer.id} className="flex flex-col items-center justify-end h-full w-28">
                            <div className="flex items-center gap-1 text-3xl font-black mb-2">
                                {count}
                                {correct && <Check className="w-7 h-7" strokeWidth={4} />}
                            </div>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(4, (count / maxCount) * 100)}%` }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className={`w-full rounded-t-xl ${ANSWER_COLORS[index]} ${correct ? '' : 'opacity-40'}`}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {question.question.answers.map((answer, index) => {
                    const correct = results.correctAnswerIds.includes(answer.id);
                    return (
                        <div
                            key={answer.id}
                            className={`p-5 rounded-2xl flex items-center shadow-xl ${ANSWER_COLORS[index]} ${correct ? '' : 'opacity-40'}`}
                        >
                            <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center text-xl font-bold mr-4">
                                {ANSWER_SHAPES[index]}
                            </div>
                            <span className="text-2xl font-bold flex-1">{answer.answerText}</span>
                            {correct ? <Check className="w-8 h-8" strokeWidth={4} /> : <X className="w-8 h-8" strokeWidth={4} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ScoreList: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => (
    <div className="w-full max-w-2xl space-y-4">
        {entries.map((entry, index) => (
            <motion.div
                key={entry.playerName}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/10"
            >
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-white/10 text-white">
                        {entry.rank}
                    </div>
                    <span className="text-2xl font-bold">{entry.playerName}</span>
                </div>
                <span className="text-2xl font-mono font-bold text-violet-300">{entry.totalPoints}</span>
            </motion.div>
        ))}
    </div>
);

// 2nd, 1st, 3rd side by side, revealed from 3rd to 1st.
const Podium: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => {
    const places = [
        { entry: entries[1], height: 'h-40', color: 'bg-slate-300 text-slate-900', delay: 0.6 },
        { entry: entries[0], height: 'h-56', color: 'bg-yellow-400 text-yellow-900', delay: 1.2 },
        { entry: entries[2], height: 'h-28', color: 'bg-amber-600 text-amber-50', delay: 0 },
    ];

    return (
        <div className="flex items-end justify-center gap-4 w-full max-w-3xl">
            {places.map(({ entry, height, color, delay }, index) =>
                entry ? (
                    <motion.div
                        key={entry.playerName}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay, duration: 0.5 }}
                        className="flex-1 flex flex-col items-center"
                    >
                        <div className="text-2xl font-bold mb-1 text-center break-all">{entry.playerName}</div>
                        <div className="text-lg font-mono text-white/70 mb-3">{entry.totalPoints}</div>
                        <div className={`w-full ${height} ${color} rounded-t-2xl flex items-start justify-center pt-4 text-5xl font-black shadow-xl`}>
                            {entry.rank}
                        </div>
                    </motion.div>
                ) : (
                    <div key={index} className="flex-1" />
                ),
            )}
        </div>
    );
};

export default HostGame;
