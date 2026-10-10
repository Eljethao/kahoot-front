export interface User {
    id: string;
    username: string;
    createdAt: string;
}

export interface Answer {
    id: string;
    answerText: string;
    isCorrect: boolean;
    order: number;
}

export interface Question {
    id: string;
    questionText: string;
    timeLimit: number;
    points: number;
    order: number;
    answers: Answer[];
}

export interface Quiz {
    id: string;
    title: string;
    description?: string;
    userId: string;
    questions: Question[];
    createdAt: string;
    updatedAt: string;
}

export interface GameSession {
    id: string;
    quizId: string;
    pin: string;
    hostId: string;
    status: 'waiting' | 'active' | 'finished';
    currentQuestion: number;
    startedAt: string;
    quiz?: Quiz;
}

export interface LeaderboardEntry {
    rank: number;
    previousRank: number; // before the current question was scored
    playerName: string;
    avatar: string;
    totalPoints: number;
    lastPoints: number; // earned on the current question
    streak: number; // correct answers in a row, as of the current question
}

export interface LobbyPlayer {
    name: string;
    avatar: string;
}

// The current question as players see it (no isCorrect).
// startedAt is when answers open, a few seconds after the question is first
// shown (the get-ready intro); see questionTimes().
export interface QuestionPayload {
    question: {
        id: string;
        questionText: string;
        timeLimit: number;
        points: number;
        answers: { id: string; answerText: string; order: number }[];
    };
    questionNumber: number;
    totalQuestions: number;
    startedAt: string;
    serverNow: string;
}

// What the host shows once a question has ended.
export interface QuestionResults {
    questionId: string;
    correctAnswerIds: string[];
    answerCounts: { answerId: string; count: number }[];
    answeredCount: number;
    totalPlayers: number;
    leaderboard: LeaderboardEntry[]; // top 5
}

export interface GameFinishedPayload {
    finished: true;
    leaderboard: LeaderboardEntry[]; // top 5
}

// lobby → question → results → question → … → finished
export type GamePhase = 'lobby' | 'question' | 'results' | 'finished';

export interface HostState {
    sessionId: string;
    pin: string;
    quizTitle: string;
    phase: GamePhase;
    players: LobbyPlayer[];
    answeredCount: number;
    question?: QuestionPayload; // question, results
    results?: QuestionResults; // results
    leaderboard?: LeaderboardEntry[]; // finished
}

export interface PlayerStanding {
    totalPoints: number;
    rank: number;
    previousRank: number; // before the current question was scored
    totalPlayers: number;
    behind: { playerName: string; points: number } | null; // the player one place ahead
}

// A player's own result for the question that just ended. pointsEarned is
// basePoints + speedBonus + streakBonus + firstBonus.
export interface PlayerResult {
    answered: boolean;
    isCorrect: boolean;
    pointsEarned: number;
    basePoints: number;
    speedBonus: number;
    streakBonus: number;
    firstBonus: number;
    streak: number; // correct answers in a row, including this one
    correctAnswers: { answerText: string; index: number }[];
}

export interface PlayerSummary {
    correctCount: number;
    answeredCount: number;
    totalQuestions: number;
    bestStreak: number;
}

export interface PlayerState {
    sessionId: string;
    playerName: string;
    avatar: string;
    phase: GamePhase;
    question?: QuestionPayload; // question
    answered?: boolean; // question
    result?: PlayerResult; // results
    standing?: PlayerStanding; // results, finished
    leaderboard?: LeaderboardEntry[]; // finished
    summary?: PlayerSummary; // finished
}

export interface JoinGameResult {
    sessionId: string;
    playerToken: string;
    playerName: string;
    avatar: string;
}

export interface CreateQuizDto {
    title: string;
    description?: string;
    questions: {
        questionText: string;
        timeLimit: number;
        points: number;
        order: number;
        answers: {
            answerText: string;
            isCorrect: boolean;
            order: number;
        }[];
    }[];
}
