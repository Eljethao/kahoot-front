import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { gameService, isNotFound, questionDeadline } from '../../services/gameService';
import { playerSession } from '../../lib/playerSession';
import { useCountdown } from '../../hooks/useCountdown';
import { ANSWER_COLORS, ANSWER_SHAPES } from '../../lib/answerStyles';
import type { LeaderboardEntry, PlayerStanding, PlayerState, QuestionPayload } from '../../types';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type View = 'loading' | 'join' | 'lobby' | 'question' | 'answered' | 'result' | 'finished';

const ordinal = (n: number) => {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${suffix}`;
};

const PlayGame: React.FC = () => {
    const [searchParams] = useSearchParams();
    // Rejoin the game this browser was in, unless the link is for another game.
    const [resumeFrom] = useState(() => {
        const saved = playerSession.load();
        const linkPin = searchParams.get('pin');
        return saved && (!linkPin || linkPin === saved.pin) ? saved : null;
    });

    const [view, setView] = useState<View>(resumeFrom ? 'loading' : 'join');
    const [sessionId, setSessionId] = useState<string | null>(resumeFrom?.sessionId ?? null);
    const [pin, setPin] = useState(searchParams.get('pin') ?? '');
    const [nickname, setNickname] = useState('');
    const [joinError, setJoinError] = useState('');
    const [joining, setJoining] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [question, setQuestion] = useState<QuestionPayload | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerError, setAnswerError] = useState('');
    const [result, setResult] = useState<PlayerState['result'] | null>(null);
    const [standing, setStanding] = useState<PlayerStanding | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const { secondsLeft, start: startCountdown } = useCountdown();

    // The player token identifies this player to the database (players don't sign in).
    const tokenRef = useRef<string | null>(resumeFrom?.token ?? null);
    // Bumped on every state change, so a slow reload can't overwrite newer state.
    const versionRef = useRef(0);
    const questionIdRef = useRef<string | null>(null);

    const backToJoin = useCallback((message = '') => {
        playerSession.clear();
        tokenRef.current = null;
        setSessionId(null);
        setView('join');
        setJoinError(message);
        startCountdown(null);
    }, [startCountdown]);

    const showQuestion = useCallback((payload: QuestionPayload, answered = false) => {
        versionRef.current++;
        if (questionIdRef.current !== payload.question.id) {
            setSelectedAnswer(null);
            setAnswerError('');
        }
        questionIdRef.current = payload.question.id;
        setQuestion(payload);
        setResult(null);
        startCountdown(questionDeadline(payload));
        setView(answered ? 'answered' : 'question');
    }, [startCountdown]);

    const applyState = useCallback((state: PlayerState) => {
        setPlayerName(state.playerName);
        if (state.phase === 'lobby') {
            setView('lobby');
        } else if (state.phase === 'question' && state.question) {
            showQuestion(state.question, state.answered);
        } else if (state.phase === 'results') {
            setResult(state.result ?? null);
            setStanding(state.standing ?? null);
            setView('result');
            startCountdown(null);
        } else if (state.phase === 'finished') {
            setStanding(state.standing ?? null);
            setLeaderboard(state.leaderboard ?? []);
            setView('finished');
            startCountdown(null);
            // Nothing more will happen in this game; a reload shows the join form.
            playerSession.clear();
            setSessionId(null);
        }
    }, [showQuestion, startCountdown]);

    // Redraws from the database: after (re)connecting, when a question or the
    // game ends, and when the phone wakes up.
    const reload = useCallback(async () => {
        const token = tokenRef.current;
        if (!token) return;
        const version = ++versionRef.current;
        try {
            const state = await gameService.getPlayerState(token);
            if (version === versionRef.current) applyState(state);
        } catch (error) {
            if (version !== versionRef.current) return;
            if (isNotFound(error)) backToJoin('You are no longer in that game.');
            else console.error('Failed to load game', error);
        }
    }, [applyState, backToJoin]);

    // Everyone fetches their result at the same moment; spread the requests out a little.
    const reloadSoon = useCallback(() => {
        setTimeout(() => void reload(), Math.random() * 400);
    }, [reload]);

    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        gameService
            .subscribeAsPlayer(sessionId, {
                onQuestion: (payload) => showQuestion(payload),
                onQuestionEnded: reloadSoon,
                onGameFinished: reloadSoon,
                onReconnect: () => void reload(),
            })
            .then((stop) => {
                if (cancelled) {
                    stop();
                    return;
                }
                unsubscribe = stop;
                // Catch up on anything that happened before we were listening.
                void reload();
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                console.error('Failed to connect to game', error);
                setView('join');
                // The saved token is kept, so reloading the page tries again.
                setJoinError('Could not connect to the game. Check your connection and reload the page.');
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
    }, [sessionId, showQuestion, reload, reloadSoon]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoining(true);
        setJoinError('');
        try {
            const joined = await gameService.joinGame(pin, nickname);
            tokenRef.current = joined.playerToken;
            playerSession.save({ token: joined.playerToken, pin: pin.trim(), sessionId: joined.sessionId });
            setPlayerName(joined.playerName);
            setView('lobby');
            setSessionId(joined.sessionId);
        } catch (error) {
            setJoinError(error instanceof Error ? error.message : 'Could not join the game');
        } finally {
            setJoining(false);
        }
    };

    const handleLeave = async () => {
        const token = tokenRef.current;
        backToJoin();
        if (token) await gameService.leaveGame(token).catch(() => undefined);
    };

    const handleAnswer = async (answerId: string) => {
        const token = tokenRef.current;
        if (!token || !question || selectedAnswer || secondsLeft === 0) return;

        const questionId = question.question.id;
        versionRef.current++;
        setSelectedAnswer(answerId);
        setView('answered');

        try {
            await gameService.submitAnswer(token, answerId);
        } catch (error) {
            if (questionIdRef.current !== questionId) return;
            setAnswerError(error instanceof Error ? error.message : 'Could not send your answer');
        }
    };

    const playAgain = () => {
        backToJoin();
        setPin('');
        setNickname('');
    };

    const selectedIndex = question?.question.answers.findIndex((a) => a.id === selectedAnswer) ?? -1;

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black" />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col">
                {view !== 'join' && view !== 'loading' && playerName && (
                    <div className="px-4 pt-4 text-sm font-bold text-white/60">{playerName}</div>
                )}

                {view === 'loading' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    </div>
                )}

                {view === 'join' && (
                    <div className="flex-1 flex items-center justify-center p-4">
                        <motion.form
                            onSubmit={handleJoin}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
                        >
                            <h1 className="text-3xl font-bold text-slate-900 text-center mb-8">Join Game</h1>
                            {joinError && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm font-medium text-center">
                                    {joinError}
                                </div>
                            )}
                            <div className="space-y-4">
                                <Input
                                    placeholder="Game PIN"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="text-center text-2xl tracking-widest font-mono h-16"
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                                <Input
                                    placeholder="Nickname"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="text-center text-xl h-14"
                                    maxLength={30}
                                    autoFocus={!!pin}
                                />
                                <Button
                                    type="submit"
                                    disabled={pin.length !== 6 || !nickname.trim()}
                                    isLoading={joining}
                                    className="w-full h-14 text-xl"
                                >
                                    Enter Game
                                </Button>
                            </div>
                        </motion.form>
                    </div>
                )}

                {view === 'lobby' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="text-6xl mb-8"
                        >
                            🎮
                        </motion.div>
                        <h2 className="text-3xl font-bold mb-4">You're in!</h2>
                        <p className="text-xl text-white/60">See your name on screen?</p>
                        <button onClick={handleLeave} className="mt-12 text-white/50 hover:text-white underline">
                            Leave game
                        </button>
                    </div>
                )}

                {view === 'question' && question && (
                    <div className="flex-1 flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="bg-white/10 px-4 py-2 rounded-full font-bold">
                                {question.questionNumber}/{question.totalQuestions}
                            </div>
                            <div className="bg-white/10 px-4 py-2 rounded-full font-mono font-bold">
                                {secondsLeft}s
                            </div>
                        </div>

                        <p className="text-center text-xl font-bold mb-6">{question.question.questionText}</p>

                        <div className="flex-1 flex flex-col justify-center">
                            <div className="grid grid-cols-1 gap-4 h-full max-h-[60vh]">
                                {question.question.answers.map((answer, index) => (
                                    <motion.button
                                        key={answer.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => handleAnswer(answer.id)}
                                        disabled={secondsLeft === 0}
                                        className={`flex-1 rounded-2xl p-6 flex items-center shadow-lg transition-transform active:scale-95 disabled:opacity-50 ${ANSWER_COLORS[index]}`}
                                    >
                                        <div className="w-10 h-10 bg-black/20 rounded-lg flex items-center justify-center text-xl font-bold mr-4">
                                            {ANSWER_SHAPES[index]}
                                        </div>
                                        <span className="text-2xl font-bold text-left">{answer.answerText}</span>
                                    </motion.button>
                                ))}
                            </div>
                            {secondsLeft === 0 && (
                                <p className="mt-6 text-center text-xl font-bold text-white/80">Time's up!</p>
                            )}
                        </div>
                    </div>
                )}

                {view === 'answered' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        {selectedIndex >= 0 && (
                            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-bold mb-8 shadow-xl ${ANSWER_COLORS[selectedIndex]}`}>
                                {ANSWER_SHAPES[selectedIndex]}
                            </div>
                        )}
                        {answerError ? (
                            <h2 className="text-3xl font-bold">{answerError}</h2>
                        ) : (
                            <>
                                <h2 className="text-3xl font-bold mb-4">Answer sent!</h2>
                                <p className="text-xl text-white/60 animate-pulse">Waiting for everyone else...</p>
                            </>
                        )}
                    </div>
                )}

                {view === 'result' && result && (
                    <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${result.isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-white text-slate-900 rounded-full w-28 h-28 flex items-center justify-center mb-8 shadow-xl text-6xl"
                        >
                            {result.isCorrect ? '✓' : result.answered ? '✗' : '⏱'}
                        </motion.div>
                        <h2 className="text-4xl font-bold mb-4">
                            {result.isCorrect ? 'Correct!' : result.answered ? 'Incorrect' : "Time's up"}
                        </h2>
                        <div className="bg-black/20 px-6 py-3 rounded-xl text-2xl font-bold">
                            +{result.pointsEarned} points
                        </div>
                        {standing && <StandingText standing={standing} />}
                    </div>
                )}

                {view === 'finished' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <h1 className="text-4xl font-bold mb-2">Game Over</h1>
                        {standing && (
                            <div className="mb-8">
                                <div className="text-6xl font-black my-4">{ordinal(standing.rank)}</div>
                                <p className="text-xl text-white/70">
                                    of {standing.totalPlayers} with {standing.totalPoints} points
                                </p>
                            </div>
                        )}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 w-full max-w-md">
                            <h3 className="text-xl font-bold mb-4">Top Players</h3>
                            {leaderboard.map((entry) => (
                                <div
                                    key={entry.playerName}
                                    className={`flex justify-between items-center p-3 rounded-lg mb-2 ${entry.playerName === playerName ? 'bg-white/20 border border-white/30' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold">#{entry.rank}</span>
                                        <span>{entry.playerName}</span>
                                    </div>
                                    <span className="font-mono font-bold">{entry.totalPoints}</span>
                                </div>
                            ))}
                        </div>
                        <Button onClick={playAgain} className="mt-8 bg-white text-slate-900 hover:bg-slate-100">
                            Join another game
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

const StandingText: React.FC<{ standing: PlayerStanding }> = ({ standing }) => {
    const { rank, behind, totalPoints } = standing;
    let detail = '';
    if (rank === 1) detail = "You're in the lead!";
    else if (behind && behind.points > 0) detail = `${behind.points} points behind ${behind.playerName}`;
    else if (behind) detail = `Tied with ${behind.playerName}`;

    return (
        <div className="mt-10">
            <p className="text-2xl font-bold">You're in {ordinal(rank)} place</p>
            {detail && <p className="text-lg text-white/80 mt-2">{detail}</p>}
            <p className="text-white/60 mt-1">{totalPoints} points total</p>
        </div>
    );
};

export default PlayGame;
