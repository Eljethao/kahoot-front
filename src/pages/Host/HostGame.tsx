import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Ban, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { gameService, isNotFound, questionTimes } from '../../services/gameService';
import { useCountdown } from '../../hooks/useCountdown';
import { useSoundState } from '../../hooks/useSoundState';
import { sound } from '../../lib/sound';
import type { GamePhase, HostState, LeaderboardEntry, QuestionPayload } from '../../types';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { GameBackground } from '../../components/game/GameBackground';
import { Scoreboard } from '../../components/game/Scoreboard';
import { Podium, type PodiumStep } from '../../components/game/Podium';
import { HostAnswerResults, HostLobby, HostQuestionIntro, HostQuestionLive } from './HostViews';

// After the countdown hits zero, wait a moment before closing the question so
// answers tapped in the last second still arrive.
const END_GRACE_MS = 1000;

// What the host screen is showing. "intro" is the question before answers
// open; "scoreboard" is the second screen of the results phase.
type HostView = 'lobby' | 'intro' | 'question' | 'results' | 'scoreboard' | 'finished';

const HostGame: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<HostState | null>(null);
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');
    const [showScoreboard, setShowScoreboard] = useState(false);
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const [confirmingVoid, setConfirmingVoid] = useState(false);
    const [busy, setBusy] = useState(false);
    const answerTimer = useCountdown(); // until the question closes
    const introTimer = useCountdown(); // until answers open
    const { muted, ready: soundReady } = useSoundState();
    const { start: startAnswerTimer } = answerTimer;
    const { start: startIntroTimer } = introTimer;

    // Bumped on every state change, so a slow reload can't overwrite newer state.
    const versionRef = useRef(0);
    const phaseRef = useRef<GamePhase | undefined>(undefined);
    const endingRef = useRef(false);

    useEffect(() => {
        phaseRef.current = state?.phase;
    }, [state?.phase]);

    const startTimers = useCallback(
        (question: QuestionPayload | null) => {
            const times = question ? questionTimes(question) : null;
            startIntroTimer(times?.opensAt ?? null);
            startAnswerTimer(times?.deadline ?? null);
        },
        [startIntroTimer, startAnswerTimer],
    );

    const showQuestion = useCallback(
        (question: QuestionPayload) => {
            versionRef.current++;
            setState((s) => s && { ...s, phase: 'question', question, results: undefined, answeredCount: 0 });
            setShowScoreboard(false);
            startTimers(question);
        },
        [startTimers],
    );

    const showFinished = useCallback(
        (leaderboard: LeaderboardEntry[]) => {
            versionRef.current++;
            setState((s) => s && { ...s, phase: 'finished', leaderboard });
            startTimers(null);
        },
        [startTimers],
    );

    // Redraws from the database: first load, reconnects, tab back in view.
    const reload = useCallback(async () => {
        if (!sessionId) return;
        const version = ++versionRef.current;
        try {
            const next = await gameService.getHostState(sessionId);
            if (version !== versionRef.current) return;
            setState(next);
            startTimers(next.phase === 'question' && next.question ? next.question : null);
        } catch (error) {
            if (isNotFound(error)) {
                setLoadError('This game does not exist or belongs to another account.');
            } else {
                console.error('Failed to load game', error);
            }
        }
    }, [sessionId, startTimers]);

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
            startTimers(null);
        } catch (error) {
            console.error('Failed to end question', error);
        } finally {
            endingRef.current = false;
        }
    }, [sessionId, startTimers]);

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
    const { deadline } = answerTimer;
    useEffect(() => {
        if (state?.phase !== 'question' || deadline === null) return;
        const timer = setTimeout(() => void endQuestion(), Math.max(0, deadline + END_GRACE_MS - Date.now()));
        return () => clearTimeout(timer);
    }, [state?.phase, deadline, endQuestion]);

    let view: HostView = 'lobby';
    if (state?.phase === 'question') view = introTimer.secondsLeft > 0 ? 'intro' : 'question';
    else if (state?.phase === 'results') view = showScoreboard ? 'scoreboard' : 'results';
    else if (state?.phase === 'finished') view = 'finished';

    // ---- Sound -------------------------------------------------------------

    // Browsers only allow audio after a click or key press. If the host got
    // here by clicking (from the dashboard), it can start right away.
    useEffect(() => {
        if (navigator.userActivation?.hasBeenActive) sound.unlock();
        const unlock = () => sound.unlock();
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            sound.music(null);
        };
    }, []);

    const loaded = state !== null;
    useEffect(() => {
        if (!loaded) return;
        sound.music(view === 'lobby' ? 'lobby' : view === 'question' ? 'question' : null);
        if (view === 'intro') sound.whoosh();
        if (view === 'results') {
            sound.gong();
            const timer = setTimeout(() => sound.reveal(), 700);
            return () => clearTimeout(timer);
        }
    }, [view, loaded]);

    const questionSecondsLeft = answerTimer.secondsLeft;
    useEffect(() => {
        if (view === 'question' && questionSecondsLeft > 0 && questionSecondsLeft <= 5) {
            sound.tick(questionSecondsLeft <= 3);
        }
    }, [view, questionSecondsLeft]);

    // A pop for each player who joins (not for the ones already there on load).
    const playerCountRef = useRef<number | null>(null);
    const playerCount = state?.players.length;
    useEffect(() => {
        if (playerCount === undefined) return;
        if (playerCountRef.current !== null && playerCount > playerCountRef.current) sound.pop();
        playerCountRef.current = playerCount;
    }, [playerCount]);

    const onPodiumStep = useCallback((step: PodiumStep, drumroll?: number) => {
        if (step === 'drumroll') sound.drumroll(drumroll ?? 1.5);
        else if (step === 'first') sound.fanfare();
        else sound.cymbal();
    }, []);

    // ---- Host actions ------------------------------------------------------

    useEffect(() => {
        if (!actionError) return;
        const timer = setTimeout(() => setActionError(''), 5000);
        return () => clearTimeout(timer);
    }, [actionError]);

    useEffect(() => {
        if (!confirmingEnd) return;
        const timer = setTimeout(() => setConfirmingEnd(false), 4000);
        return () => clearTimeout(timer);
    }, [confirmingEnd]);

    useEffect(() => {
        if (!confirmingVoid) return;
        const timer = setTimeout(() => setConfirmingVoid(false), 4000);
        return () => clearTimeout(timer);
    }, [confirmingVoid]);

    const runHostAction = async (action: (sessionId: string) => Promise<void>) => {
        if (!sessionId || busy) return;
        setBusy(true);
        setActionError('');
        try {
            await action(sessionId);
        } catch (error) {
            console.error('Host action failed', error);
            setActionError(error instanceof Error ? error.message : 'Something went wrong');
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

    const kickPlayer = (playerName: string) => runHostAction((id) => gameService.kickPlayer(id, playerName));

    const cancelGame = () =>
        runHostAction(async (id) => {
            await gameService.endGame(id);
            navigate('/dashboard');
        });

    // For a question whose correct answer was set wrong: everyone's points for
    // it are taken back, and players' screens say it wasn't counted.
    const voidQuestion = () => {
        if (!confirmingVoid) {
            setConfirmingVoid(true);
            return;
        }
        setConfirmingVoid(false);
        void runHostAction(async (id) => {
            const voided = await gameService.voidQuestion(id);
            versionRef.current++;
            setState((s) => s && { ...s, results: voided });
        });
    };

    const endGameEarly = () => {
        if (!confirmingEnd) {
            setConfirmingEnd(true);
            return;
        }
        setConfirmingEnd(false);
        void runHostAction(async (id) => showFinished((await gameService.endGame(id)).leaderboard));
    };

    if (loadError) {
        return (
            <GameBackground>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
                    <p className="max-w-md text-xl font-semibold">{loadError}</p>
                    <Button variant="light" onClick={() => navigate('/dashboard')}>
                        Back to dashboard
                    </Button>
                </div>
            </GameBackground>
        );
    }

    if (!state) {
        return (
            <GameBackground>
                <div className="flex-1 flex items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                </div>
            </GameBackground>
        );
    }

    const question = state.question;
    const results = state.results;
    const isLastQuestion = !!question && question.questionNumber === question.totalQuestions;
    const leaderboard = state.leaderboard ?? [];

    return (
        <GameBackground>
            <header className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Logo inverted showName={false} />
                    <span className="truncate text-lg font-bold text-white/80">{state.quizTitle}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {question && (view === 'question' || view === 'results' || view === 'scoreboard') && (
                        <span className="tabular hidden sm:inline rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold">
                            {question.questionNumber} / {question.totalQuestions}
                        </span>
                    )}
                    <Button
                        variant="glass"
                        size="sm"
                        onClick={() => {
                            sound.unlock();
                            if (soundReady) sound.setMuted(!muted);
                        }}
                        title={muted ? 'Unmute' : 'Mute'}
                    >
                        {muted || !soundReady ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        {!soundReady && !muted && <span className="hidden sm:inline">Enable sound</span>}
                    </Button>
                    {(view === 'results' || view === 'scoreboard') && results && !results.voided && (
                        <Button
                            variant={confirmingVoid ? 'danger' : 'glass'}
                            size="sm"
                            disabled={busy}
                            onClick={voidQuestion}
                            title="Take back everyone's points for this question, e.g. if its correct answer was set wrong"
                        >
                            <Ban className="w-4 h-4" />
                            {confirmingVoid ? 'Click to remove its points' : "Don't count"}
                        </Button>
                    )}
                    {view === 'question' && (
                        <Button variant="glass" size="sm" onClick={() => void endQuestion()}>
                            Skip <SkipForward className="w-4 h-4" />
                        </Button>
                    )}
                    {view !== 'finished' && (
                        <Button
                            variant={confirmingEnd ? 'danger' : 'glass'}
                            size="sm"
                            disabled={busy}
                            onClick={state.phase === 'lobby' ? cancelGame : endGameEarly}
                        >
                            {state.phase === 'lobby' ? 'Cancel' : confirmingEnd ? 'Click to end game' : 'End game'}
                        </Button>
                    )}
                </div>
            </header>

            {view === 'lobby' && (
                <HostLobby pin={state.pin} players={state.players} busy={busy} onStart={startGame} onKick={kickPlayer} />
            )}

            {view === 'intro' && question && <HostQuestionIntro question={question} secondsLeft={introTimer.secondsLeft} />}

            {view === 'question' && question && (
                <HostQuestionLive
                    question={question}
                    secondsLeft={answerTimer.secondsLeft}
                    answeredCount={state.answeredCount}
                    totalPlayers={state.players.length}
                />
            )}

            {view === 'results' && question && results && (
                <HostAnswerResults
                    question={question}
                    results={results}
                    busy={busy}
                    isLastQuestion={isLastQuestion}
                    onNext={isLastQuestion ? advance : () => setShowScoreboard(true)}
                />
            )}

            {view === 'scoreboard' && results && (
                <div className="flex-1 flex flex-col items-center px-4 sm:px-8 pb-10">
                    <motion.h2
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mb-8 mt-2 text-4xl sm:text-5xl font-extrabold"
                    >
                        Scoreboard
                    </motion.h2>
                    {results.voided && question && (
                        <p className="-mt-5 mb-6 flex items-center gap-2 font-semibold text-white/70">
                            <Ban className="h-4 w-4" /> Question {question.questionNumber} was not counted
                        </p>
                    )}
                    <Scoreboard key={results.questionId} entries={results.leaderboard} reorder onReorder={sound.whoosh} />
                    <Button variant="light" size="lg" className="mt-10" onClick={advance} disabled={busy}>
                        Next question <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {view === 'finished' && (
                <div className="flex-1 flex flex-col items-center px-4 sm:px-8 pb-10">
                    <motion.h1
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mt-2 text-center text-3xl sm:text-5xl font-extrabold"
                    >
                        {state.quizTitle}
                    </motion.h1>
                    <p className="mt-1 text-lg font-semibold text-white/60">Final results</p>
                    {leaderboard.length === 0 ? (
                        <p className="mt-16 text-xl text-white/60">Nobody played this game.</p>
                    ) : (
                        <Podium entries={leaderboard.slice(0, 3)} onStep={onPodiumStep} />
                    )}
                    {leaderboard.length > 3 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 7.2 }}
                            className="mt-8 flex w-full justify-center"
                        >
                            <Scoreboard entries={leaderboard.slice(3)} />
                        </motion.div>
                    )}
                    <Button variant="light" size="lg" className="mt-10" onClick={() => navigate('/dashboard')}>
                        Back to dashboard
                    </Button>
                </div>
            )}

            <AnimatePresence>
                {actionError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        role="alert"
                        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-rose-600 px-5 py-3 font-semibold shadow-xl"
                    >
                        {actionError}
                    </motion.div>
                )}
            </AnimatePresence>
        </GameBackground>
    );
};

export default HostGame;
