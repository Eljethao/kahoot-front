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
    playerName: string;
    totalPoints: number;
}

// The current question as players see it (no isCorrect).
// Time left = timeLimit - (serverNow - startedAt); see questionDeadline().
export interface QuestionPayload {
    question: {
        id: string;
        questionText: string;
        timeLimit: number;
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
    players: string[];
    answeredCount: number;
    question?: QuestionPayload; // question, results
    results?: QuestionResults; // results
    leaderboard?: LeaderboardEntry[]; // finished
}

export interface PlayerStanding {
    totalPoints: number;
    rank: number;
    totalPlayers: number;
    behind: { playerName: string; points: number } | null; // the player one place ahead
}

export interface PlayerState {
    sessionId: string;
    playerName: string;
    phase: GamePhase;
    question?: QuestionPayload; // question
    answered?: boolean; // question
    result?: { answered: boolean; isCorrect: boolean; pointsEarned: number }; // results
    standing?: PlayerStanding; // results, finished
    leaderboard?: LeaderboardEntry[]; // finished
}

export interface JoinGameResult {
    sessionId: string;
    playerToken: string;
    playerName: string;
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
