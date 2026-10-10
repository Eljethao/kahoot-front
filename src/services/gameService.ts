import { supabase } from '../lib/supabase';
import type {
    GameFinishedPayload,
    GameSession,
    HostState,
    JoinGameResult,
    LobbyPlayer,
    PlayerState,
    QuestionPayload,
    QuestionResults,
} from '../types';

// Keeps the Postgres error code, e.g. P0002 for "not found".
export class GameError extends Error {
    code?: string;

    constructor(message: string, code?: string) {
        super(message);
        this.code = code;
    }
}

export const isNotFound = (error: unknown) => error instanceof GameError && error.code === 'P0002';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new GameError(error.message, error.code);
    return data as T;
}

// When answers open (after the get-ready intro) and when the question closes,
// in local time. Uses the server's own clock difference, so it works after a
// reload and with a wrong device clock.
export function questionTimes(payload: QuestionPayload): { opensAt: number; deadline: number } {
    const opensAt = Date.now() + Date.parse(payload.startedAt) - Date.parse(payload.serverNow);
    return { opensAt, deadline: opensAt + payload.question.timeLimit * 1000 };
}

// supabase.channel() hands back the existing channel when a topic is already
// open, and subscribing it again does nothing. So subscriptions to the same
// topic queue up: each waits until the previous one has been removed. (In
// development, StrictMode subscribes, unsubscribes and subscribes again.)
const topicReleased = new Map<string, Promise<void>>();

// Joins a private broadcast channel and resolves once the join is confirmed,
// so nothing broadcast after that point is missed. supabase-js rejoins by
// itself after a dropped connection; onReconnect lets the page catch up on
// anything sent while it was away. Only the database sends on these channels
// (see supabase/migrations); clients just listen.
async function subscribe(
    topic: string,
    handlers: Record<string, (payload: never) => void>,
    onReconnect?: () => void,
): Promise<() => void> {
    const previous = topicReleased.get(topic);
    let release: () => void = () => undefined;
    topicReleased.set(topic, new Promise<void>((resolve) => (release = resolve)));
    await previous;

    await supabase.realtime.setAuth();
    const channel = supabase.channel(topic, { config: { private: true } });
    for (const [event, handler] of Object.entries(handlers)) {
        // Payload shapes are defined by the SQL functions that broadcast them.
        channel.on('broadcast', { event }, ({ payload }) => handler(payload as never));
    }

    let joined = false;
    try {
        await new Promise<void>((resolve, reject) => {
            channel.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    if (joined) {
                        onReconnect?.();
                    } else {
                        joined = true;
                        resolve();
                    }
                } else if (!joined) {
                    reject(err ?? new Error(`Could not connect to the game (${status})`));
                }
            });
        });
    } catch (error) {
        await supabase.removeChannel(channel);
        release();
        throw error;
    }

    return () => {
        void supabase.removeChannel(channel).finally(release);
    };
}

export const gameService = {
    // Host

    async createGame(quizId: string): Promise<GameSession> {
        return rpc<GameSession>('create_game', { p_quiz_id: quizId });
    },

    async getHostState(sessionId: string): Promise<HostState> {
        return rpc<HostState>('get_host_state', { p_session_id: sessionId });
    },

    async startGame(sessionId: string): Promise<QuestionPayload> {
        return rpc<QuestionPayload>('start_game', { p_session_id: sessionId });
    },

    async endQuestion(sessionId: string): Promise<QuestionResults> {
        return rpc<QuestionResults>('end_question', { p_session_id: sessionId });
    },

    async nextQuestion(sessionId: string): Promise<QuestionPayload | GameFinishedPayload> {
        return rpc<QuestionPayload | GameFinishedPayload>('next_question', { p_session_id: sessionId });
    },

    async endGame(sessionId: string): Promise<GameFinishedPayload> {
        return rpc<GameFinishedPayload>('end_game', { p_session_id: sessionId });
    },

    // Removes a player from the lobby (only before the game starts).
    async kickPlayer(sessionId: string, playerName: string): Promise<void> {
        await rpc('kick_player', { p_session_id: sessionId, p_player_name: playerName });
    },

    subscribeAsHost(
        sessionId: string,
        handlers: {
            onPlayersChanged: (players: LobbyPlayer[]) => void;
            onAnswerCount: (answeredCount: number, totalPlayers: number) => void;
            onReconnect: () => void;
        },
    ) {
        return subscribe(
            `host:${sessionId}`,
            {
                playersChanged: (data: { players: LobbyPlayer[] }) => handlers.onPlayersChanged(data.players),
                answerCount: (data: { answeredCount: number; totalPlayers: number }) =>
                    handlers.onAnswerCount(data.answeredCount, data.totalPlayers),
            },
            handlers.onReconnect,
        );
    },

    // Player

    async joinGame(pin: string, playerName: string): Promise<JoinGameResult> {
        return rpc<JoinGameResult>('join_game', { p_pin: pin.trim(), p_name: playerName });
    },

    async setAvatar(playerToken: string, avatar: string): Promise<void> {
        await rpc('set_avatar', { p_player_token: playerToken, p_avatar: avatar });
    },

    async getPlayerState(playerToken: string): Promise<PlayerState> {
        return rpc<PlayerState>('get_player_state', { p_player_token: playerToken });
    },

    // Only confirms the answer arrived; the result comes with getPlayerState
    // after the question ends.
    async submitAnswer(playerToken: string, answerId: string): Promise<void> {
        await rpc('submit_answer', { p_player_token: playerToken, p_answer_id: answerId });
    },

    // Removes the player from the lobby (no effect once the game has started).
    async leaveGame(playerToken: string): Promise<void> {
        await rpc('leave_game', { p_player_token: playerToken });
    },

    // questionEnded and gameFinished carry no results; call getPlayerState.
    subscribeAsPlayer(
        sessionId: string,
        handlers: {
            onQuestion: (data: QuestionPayload) => void;
            onQuestionEnded: () => void;
            onGameFinished: () => void;
            onPlayerKicked: (playerName: string) => void;
            onReconnect: () => void;
        },
    ) {
        return subscribe(
            `game:${sessionId}`,
            {
                question: handlers.onQuestion,
                questionEnded: () => handlers.onQuestionEnded(),
                gameFinished: () => handlers.onGameFinished(),
                playerKicked: (data: { playerName: string }) => handlers.onPlayerKicked(data.playerName),
            },
            handlers.onReconnect,
        );
    },
};
