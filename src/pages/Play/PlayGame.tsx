import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { gameService, isNotFound, questionTimes } from '../../services/gameService';
import { playerSession } from '../../lib/playerSession';
import { useCountdown } from '../../hooks/useCountdown';
import { ANSWER_COLORS } from '../../lib/answerStyles';
import { cn } from '../../lib/utils';
import type { LeaderboardEntry, PlayerResult, PlayerStanding, PlayerState, PlayerSummary, QuestionPayload } from '../../types';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { AnswerShape } from '../../components/game/AnswerShape';
import { Avatar } from '../../components/game/Avatar';
import { GameBackground } from '../../components/game/GameBackground';
import { AvatarPickerView, PlayerAnsweredView, PlayerFinishedView, PlayerIntroView, PlayerResultView } from './PlayViews';

type View = 'loading' | 'join' | 'avatar' | 'lobby' | 'question' | 'answered' | 'result' | 'finished';

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
    const [avatar, setAvatar] = useState('');
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState('');
    const [question, setQuestion] = useState<QuestionPayload | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerError, setAnswerError] = useState('');
    const [result, setResult] = useState<PlayerResult | null>(null);
    const [standing, setStanding] = useState<PlayerStanding | null>(null);
    const [summary, setSummary] = useState<PlayerSummary | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const answerTimer = useCountdown(); // until the question closes
    const introTimer = useCountdown(); // until answers open
    const { start: startAnswerTimer } = answerTimer;
    const { start: startIntroTimer } = introTimer;

    // The player token identifies this player to the database (players don't sign in).
    const tokenRef = useRef<string | null>(resumeFrom?.token ?? null);
    // Bumped on every state change, so a slow reload can't overwrite newer state.
    const versionRef = useRef(0);
    const questionIdRef = useRef<string | null>(null);
    const playerNameRef = useRef('');

    useEffect(() => {
        playerNameRef.current = playerName;
    }, [playerName]);

    const startTimers = useCallback(
        (payload: QuestionPayload | null) => {
            const times = payload ? questionTimes(payload) : null;
            startIntroTimer(times?.opensAt ?? null);
            startAnswerTimer(times?.deadline ?? null);
        },
        [startIntroTimer, startAnswerTimer],
    );

    const backToJoin = useCallback(
        (message = '') => {
            playerSession.clear();
            tokenRef.current = null;
            setSessionId(null);
            setView('join');
            setJoinError(message);
            startTimers(null);
        },
        [startTimers],
    );

    const showQuestion = useCallback(
        (payload: QuestionPayload, answered = false) => {
            versionRef.current++;
            if (questionIdRef.current !== payload.question.id) {
                setSelectedAnswer(null);
                setAnswerError('');
            }
            questionIdRef.current = payload.question.id;
            setQuestion(payload);
            setResult(null);
            startTimers(payload);
            setView(answered ? 'answered' : 'question');
        },
        [startTimers],
    );

    const applyState = useCallback(
        (state: PlayerState) => {
            setPlayerName(state.playerName);
            setAvatar(state.avatar);
            if (state.phase === 'lobby') {
                // Don't close the avatar picker; the player is still in the lobby.
                setView((current) => (current === 'avatar' ? current : 'lobby'));
            } else if (state.phase === 'question' && state.question) {
                showQuestion(state.question, state.answered);
            } else if (state.phase === 'results') {
                setResult(state.result ?? null);
                setStanding(state.standing ?? null);
                setView('result');
                startTimers(null);
            } else if (state.phase === 'finished') {
                setStanding(state.standing ?? null);
                setSummary(state.summary ?? null);
                setLeaderboard(state.leaderboard ?? []);
                setView('finished');
                startTimers(null);
                // Nothing more will happen in this game; a reload shows the join form.
                playerSession.clear();
                setSessionId(null);
            }
        },
        [showQuestion, startTimers],
    );

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
                onQuestionVoided: reloadSoon,
                onGameFinished: reloadSoon,
                onPlayerKicked: (name) => {
                    if (name === playerNameRef.current) backToJoin('The host removed you from the game.');
                },
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
    }, [sessionId, showQuestion, reload, reloadSoon, backToJoin]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoining(true);
        setJoinError('');
        try {
            const joined = await gameService.joinGame(pin, nickname);
            tokenRef.current = joined.playerToken;
            playerSession.save({ token: joined.playerToken, pin: pin.trim(), sessionId: joined.sessionId });
            setPlayerName(joined.playerName);
            setAvatar(joined.avatar);
            setAvatarError('');
            setView('avatar');
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

    const handleAvatar = async (choice: string) => {
        const token = tokenRef.current;
        if (!token) return;
        // A reload that started before this would bring back the old avatar.
        versionRef.current++;
        setSavingAvatar(true);
        setAvatarError('');
        try {
            await gameService.setAvatar(token, choice);
            setAvatar(choice);
            // The game may have started meanwhile; then the question is already showing.
            setView((current) => (current === 'avatar' ? 'lobby' : current));
        } catch (error) {
            if (isNotFound(error)) backToJoin('You are no longer in that game.');
            else setAvatarError(error instanceof Error ? error.message : 'Could not save your avatar');
        } finally {
            setSavingAvatar(false);
        }
    };

    const inIntro = view === 'question' && introTimer.secondsLeft > 0;
    const timeUp = answerTimer.secondsLeft === 0;

    const handleAnswer = async (answerId: string) => {
        const token = tokenRef.current;
        if (!token || !question || selectedAnswer || inIntro || timeUp) return;

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
    const showPlayerBar = view !== 'join' && view !== 'loading' && view !== 'avatar' && view !== 'result' && !!playerName;

    return (
        <GameBackground>
            {showPlayerBar && (
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                    <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-4">
                        <Avatar avatar={avatar} className="h-8 w-8 bg-white/15 text-xl" />
                        <span className="truncate font-bold">{playerName}</span>
                    </div>
                    {question && (view === 'question' || view === 'answered') && (
                        <span className="tabular shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                            {question.questionNumber}/{question.totalQuestions}
                        </span>
                    )}
                </div>
            )}

            {view === 'loading' && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                </div>
            )}

            {view === 'join' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-8 p-4">
                    <Logo inverted className="scale-125" />
                    <motion.form
                        onSubmit={handleJoin}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-900 shadow-2xl shadow-black/30"
                    >
                        {joinError && (
                            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-600">
                                {joinError}
                            </div>
                        )}
                        <div className="space-y-3">
                            <input
                                aria-label="Game PIN"
                                placeholder="Game PIN"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                inputMode="numeric"
                                maxLength={6}
                                className="tabular h-14 w-full rounded-xl border-2 border-slate-200 text-center text-2xl font-extrabold tracking-[0.3em] placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-300 focus:border-game-800 focus:outline-none"
                            />
                            <input
                                aria-label="Nickname"
                                placeholder="Nickname"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                maxLength={30}
                                autoFocus={!!pin}
                                className="h-14 w-full rounded-xl border-2 border-slate-200 text-center text-xl font-bold placeholder:text-slate-300 focus:border-game-800 focus:outline-none"
                            />
                            <Button
                                type="submit"
                                disabled={pin.length !== 6 || !nickname.trim()}
                                isLoading={joining}
                                className="h-14 w-full bg-slate-900 text-lg hover:bg-slate-800"
                            >
                                Enter
                            </Button>
                        </div>
                    </motion.form>
                </div>
            )}

            {view === 'avatar' && (
                <AvatarPickerView
                    playerName={playerName}
                    avatar={avatar}
                    saving={savingAvatar}
                    error={avatarError}
                    onConfirm={handleAvatar}
                />
            )}

            {view === 'lobby' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <motion.button
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        onClick={() => {
                            setAvatarError('');
                            setView('avatar');
                        }}
                        aria-label="Change avatar"
                        className="relative cursor-pointer"
                    >
                        <Avatar avatar={avatar} className="h-28 w-28 bg-white/15 text-6xl ring-4 ring-white/20" />
                        <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-game-900 shadow-lg">
                            <Pencil className="h-4 w-4" />
                        </span>
                    </motion.button>
                    <h2 className="mt-8 text-3xl font-extrabold">You're in!</h2>
                    <p className="mt-2 text-lg text-white/70">See your name on screen?</p>
                    <button onClick={handleLeave} className="mt-12 text-sm font-semibold text-white/50 underline hover:text-white cursor-pointer">
                        Leave game
                    </button>
                </div>
            )}

            {view === 'question' && question && inIntro && (
                <PlayerIntroView
                    questionNumber={question.questionNumber}
                    totalQuestions={question.totalQuestions}
                    questionText={question.question.questionText}
                    points={question.question.points}
                    secondsLeft={introTimer.secondsLeft}
                />
            )}

            {view === 'question' && question && !inIntro && (
                <div className="flex-1 flex flex-col gap-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-xl font-bold leading-snug">{question.question.questionText}</p>
                        <span
                            className={cn(
                                'tabular shrink-0 rounded-full px-3 py-1 text-lg font-extrabold',
                                answerTimer.secondsLeft <= 5 ? 'bg-rose-500' : 'bg-white/15',
                            )}
                        >
                            {answerTimer.secondsLeft}
                        </span>
                    </div>

                    <div
                        className={cn(
                            'grid flex-1 gap-3',
                            question.question.answers.length > 2 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1 grid-rows-2',
                        )}
                    >
                        {question.question.answers.map((answer, index) => (
                            <motion.button
                                key={answer.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleAnswer(answer.id)}
                                disabled={timeUp}
                                className={cn(
                                    'flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl p-4 shadow-lg shadow-black/20 disabled:opacity-50 cursor-pointer',
                                    ANSWER_COLORS[index],
                                )}
                            >
                                <AnswerShape index={index} className="h-10 w-10 text-white" />
                                <span className="text-lg font-bold leading-tight">{answer.answerText}</span>
                            </motion.button>
                        ))}
                    </div>
                    {timeUp && <p className="text-center text-xl font-bold text-white/80">Time's up!</p>}
                </div>
            )}

            {view === 'answered' && question && (
                <PlayerAnsweredView selectedIndex={selectedIndex} error={answerError} questionId={question.question.id} />
            )}

            {view === 'result' && result && (
                // Keyed so the screen animates in again if the host removes the question.
                <PlayerResultView key={result.voided ? 'voided' : 'scored'} result={result} standing={standing} />
            )}

            {view === 'finished' && (
                <PlayerFinishedView
                    playerName={playerName}
                    standing={standing}
                    summary={summary}
                    leaderboard={leaderboard}
                    onPlayAgain={playAgain}
                />
            )}
        </GameBackground>
    );
};

export default PlayGame;
