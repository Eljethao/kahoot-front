import { supabase } from '../lib/supabase';
import type { Quiz, CreateQuizDto } from '../types';

const QUIZ_COLUMNS = `
    id, title, description, user_id, created_at, updated_at,
    questions (
        id, question_text, time_limit, points, sort_order,
        answers ( id, answer_text, is_correct, sort_order )
    )
`;

interface AnswerRow {
    id: string;
    answer_text: string;
    is_correct: boolean;
    sort_order: number;
}

interface QuestionRow {
    id: string;
    question_text: string;
    time_limit: number;
    points: number;
    sort_order: number;
    answers: AnswerRow[];
}

interface QuizRow {
    id: string;
    title: string;
    description: string | null;
    user_id: string;
    created_at: string;
    updated_at: string;
    questions: QuestionRow[];
}

// Same order the database uses when it picks the current question.
const bySortOrder = (a: { sort_order: number; id: string }, b: { sort_order: number; id: string }) =>
    a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const toQuiz = (row: QuizRow): Quiz => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions: [...row.questions].sort(bySortOrder).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        timeLimit: q.time_limit,
        points: q.points,
        order: q.sort_order,
        answers: [...q.answers].sort(bySortOrder).map((a) => ({
            id: a.id,
            answerText: a.answer_text,
            isCorrect: a.is_correct,
            order: a.sort_order,
        })),
    })),
});

export const quizService = {
    async getAll(): Promise<Quiz[]> {
        const { data, error } = await supabase
            .from('quizzes')
            .select(QUIZ_COLUMNS)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as QuizRow[]).map(toQuiz);
    },

    async getOne(id: string): Promise<Quiz> {
        const { data, error } = await supabase.from('quizzes').select(QUIZ_COLUMNS).eq('id', id).single();
        if (error) throw error;
        return toQuiz(data as QuizRow);
    },

    async create(quiz: CreateQuizDto): Promise<Quiz> {
        const { data: id, error } = await supabase.rpc('save_quiz', {
            p_title: quiz.title,
            p_description: quiz.description ?? null,
            p_questions: quiz.questions,
        });
        if (error) throw error;
        return this.getOne(id as string);
    },

    // Passing questions replaces all of the quiz's questions (their ids change).
    async update(id: string, quiz: Partial<CreateQuizDto>): Promise<Quiz> {
        const { error } = await supabase.rpc('save_quiz', {
            p_quiz_id: id,
            p_title: quiz.title ?? null,
            p_description: quiz.description ?? null,
            p_questions: quiz.questions ?? null,
        });
        if (error) throw error;
        return this.getOne(id);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('quizzes').delete().eq('id', id);
        if (error) throw error;
    },
};
