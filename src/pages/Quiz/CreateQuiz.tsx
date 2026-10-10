import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Check, Clock, Zap, Copy } from 'lucide-react';
import { quizService } from '../../services/quizService';
import type { CreateQuizDto, Question } from '../../types';
import { Button } from '../../components/ui/Button';
import { AnswerShape } from '../../components/game/AnswerShape';
import { ANSWER_COLORS } from '../../lib/answerStyles';
import { cn } from '../../lib/utils';

type QuestionDraft = CreateQuizDto['questions'][number];
type AnswerDraft = QuestionDraft['answers'][number];

const TIME_LIMITS = [5, 10, 20, 30, 60, 90];
const POINT_OPTIONS = [
    { value: 1000, label: 'Standard' },
    { value: 2000, label: 'Double' },
    { value: 0, label: 'No points' },
];

const blankAnswers = (): AnswerDraft[] =>
    [1, 2, 3, 4].map((order) => ({ answerText: '', isCorrect: false, order }));

const blankQuestion = (order: number): QuestionDraft => ({
    questionText: '',
    timeLimit: 20,
    points: 1000,
    order,
    answers: blankAnswers(),
});

// A saved question as an editor draft, with empty slots up to 4 answers.
const toDraft = (question: Question): QuestionDraft => ({
    questionText: question.questionText,
    timeLimit: question.timeLimit,
    points: question.points,
    order: question.order,
    answers: [
        ...question.answers.map((a) => ({ answerText: a.answerText, isCorrect: a.isCorrect, order: a.order })),
        ...blankAnswers(),
    ].slice(0, 4),
});

// Same rules as save_quiz in the database, checked here first so the editor
// can jump to the question that needs fixing. Blank answer slots are allowed
// and dropped before saving.
function findProblem(questions: QuestionDraft[]): { index: number; message: string } | null {
    for (const [index, q] of questions.entries()) {
        const filled = q.answers.filter((a) => a.answerText.trim());
        let message = '';
        if (!q.questionText.trim()) message = 'Enter the question text.';
        else if (filled.length < 2) message = 'Add at least 2 answers.';
        else if (q.answers.some((a) => a.isCorrect && !a.answerText.trim())) message = 'A correct answer is empty.';
        else if (!filled.some((a) => a.isCorrect)) message = 'Mark at least one correct answer.';
        if (message) return { index, message: `Question ${index + 1}: ${message}` };
    }
    return null;
}

const toSave = (questions: QuestionDraft[]): QuestionDraft[] =>
    questions.map((q, qIndex) => ({
        ...q,
        questionText: q.questionText.trim(),
        order: qIndex + 1,
        answers: q.answers
            .filter((a) => a.answerText.trim())
            .map((a, aIndex) => ({ ...a, answerText: a.answerText.trim(), order: aIndex + 1 })),
    }));

// Creates a quiz, or edits one when opened at /quiz/edit/:quizId.
const CreateQuiz: React.FC = () => {
    const navigate = useNavigate();
    const { quizId } = useParams<{ quizId: string }>();
    const editing = !!quizId;
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<QuestionDraft[]>([blankQuestion(1)]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [loadingQuiz, setLoadingQuiz] = useState(editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!quizId) return;
        let cancelled = false;
        quizService
            .getOne(quizId)
            .then((quiz) => {
                if (cancelled) return;
                setTitle(quiz.title);
                setDescription(quiz.description ?? '');
                setQuestions(quiz.questions.length ? quiz.questions.map(toDraft) : [blankQuestion(1)]);
            })
            .catch((err: unknown) => {
                console.error('Failed to load quiz', err);
                if (!cancelled) setError('Could not load this quiz.');
            })
            .finally(() => {
                if (!cancelled) setLoadingQuiz(false);
            });
        return () => {
            cancelled = true;
        };
    }, [quizId]);

    const updateQuestion = (index: number, change: Partial<QuestionDraft>) => {
        setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...change } : q)));
        setError('');
    };

    const updateAnswer = (qIndex: number, aIndex: number, change: Partial<AnswerDraft>) => {
        setQuestions((current) =>
            current.map((q, i) =>
                i === qIndex ? { ...q, answers: q.answers.map((a, j) => (j === aIndex ? { ...a, ...change } : a)) } : q,
            ),
        );
        setError('');
    };

    const addQuestion = () => {
        setQuestions((current) => [...current, blankQuestion(current.length + 1)]);
        setActiveQuestionIndex(questions.length);
    };

    const duplicateQuestion = (index: number) => {
        setQuestions((current) => [
            ...current.slice(0, index + 1),
            { ...current[index], answers: current[index].answers.map((a) => ({ ...a })) },
            ...current.slice(index + 1),
        ]);
        setActiveQuestionIndex(index + 1);
    };

    const removeQuestion = (index: number) => {
        if (questions.length === 1) return;
        setQuestions((current) => current.filter((_, i) => i !== index));
        setActiveQuestionIndex((active) => Math.min(active > index ? active - 1 : active, questions.length - 2));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const problem = findProblem(questions);
        if (problem) {
            setActiveQuestionIndex(problem.index);
            setError(problem.message);
            return;
        }

        setSaving(true);
        try {
            const quiz = { title: title.trim(), description: description.trim(), questions: toSave(questions) };
            if (quizId) await quizService.update(quizId, quiz);
            else await quizService.create(quiz);
            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to save quiz', err);
            setError(err instanceof Error ? err.message : 'Failed to save quiz');
        } finally {
            setSaving(false);
        }
    };

    if (loadingQuiz) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            </div>
        );
    }

    const activeQuestion = questions[activeQuestionIndex] ?? questions[0];
    const timeLimits = TIME_LIMITS.includes(activeQuestion.timeLimit)
        ? TIME_LIMITS
        : [...TIME_LIMITS, activeQuestion.timeLimit].sort((a, b) => a - b);

    return (
        <div className="flex h-screen flex-col bg-slate-50">
            <header className="z-30 border-b border-slate-200 bg-white">
                <div className="flex h-16 items-center justify-between gap-3 px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Back</span>
                        </Button>
                        <div className="h-6 w-px bg-slate-200" />
                        <input
                            type="text"
                            aria-label="Quiz title"
                            placeholder="Untitled quiz"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-lg font-bold text-slate-900 placeholder:text-slate-300 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        />
                    </div>
                    <Button onClick={handleSubmit} isLoading={saving} disabled={!title.trim()}>
                        {!saving && <Check className="h-4 w-4" />}
                        {editing ? 'Save changes' : 'Save quiz'}
                    </Button>
                </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* Question list */}
                <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-72 md:border-b-0 md:border-r">
                    <div className="hidden p-4 md:block">
                        <label htmlFor="quiz-description" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Description
                        </label>
                        <textarea
                            id="quiz-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this quiz about? (optional)"
                            rows={2}
                            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                        />
                        {editing && (
                            <p className="mt-1 text-xs text-slate-400">
                                Saving replaces the questions, which clears results from past games of this quiz.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-visible md:px-4 md:pt-0">
                        {questions.map((q, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => setActiveQuestionIndex(index)}
                                className={cn(
                                    'group relative w-44 shrink-0 cursor-pointer rounded-xl border p-3 transition-colors md:w-auto',
                                    activeQuestionIndex === index
                                        ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                                        : 'border-slate-200 bg-white hover:border-slate-300',
                                )}
                            >
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">Question {index + 1}</span>
                                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                duplicateQuestion(index);
                                            }}
                                            className="rounded p-0.5 text-slate-400 hover:text-brand-600 cursor-pointer"
                                            title="Duplicate"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                        {questions.length > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeQuestion(index);
                                                }}
                                                className="rounded p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-700">
                                    {q.questionText || <span className="text-slate-300">Empty question</span>}
                                </p>
                                <div className="mt-2 flex gap-1">
                                    {q.answers.map((a, aIndex) => (
                                        <span
                                            key={aIndex}
                                            className={cn(
                                                'h-1.5 flex-1 rounded-full',
                                                a.answerText.trim() ? ANSWER_COLORS[aIndex] : 'bg-slate-100',
                                                a.answerText.trim() && !a.isCorrect && 'opacity-30',
                                            )}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        ))}

                        <Button variant="outline" className="w-44 shrink-0 border-dashed md:w-full" onClick={addQuestion}>
                            <Plus className="h-4 w-4" />
                            Add question
                        </Button>
                    </div>
                </aside>

                {/* Question editor */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    <div className="mx-auto max-w-4xl space-y-6">
                        {error && (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                            <textarea
                                aria-label="Question"
                                value={activeQuestion.questionText}
                                onChange={(e) => updateQuestion(activeQuestionIndex, { questionText: e.target.value })}
                                placeholder="Type your question"
                                rows={2}
                                className="w-full resize-none rounded-xl bg-transparent px-4 py-4 text-center text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none sm:text-3xl"
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                <Clock className="ml-2 h-4 w-4 text-slate-400" />
                                {timeLimits.map((seconds) => (
                                    <button
                                        key={seconds}
                                        onClick={() => updateQuestion(activeQuestionIndex, { timeLimit: seconds })}
                                        className={cn(
                                            'rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer',
                                            activeQuestion.timeLimit === seconds
                                                ? 'bg-brand-600 text-white'
                                                : 'text-slate-600 hover:bg-slate-100',
                                        )}
                                    >
                                        {seconds}s
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                <Zap className="ml-2 h-4 w-4 text-slate-400" />
                                {POINT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => updateQuestion(activeQuestionIndex, { points: option.value })}
                                        className={cn(
                                            'rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer',
                                            activeQuestion.points === option.value
                                                ? 'bg-brand-600 text-white'
                                                : 'text-slate-600 hover:bg-slate-100',
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {activeQuestion.answers.map((answer, aIndex) => {
                                const filled = !!answer.answerText.trim();
                                return (
                                    <div
                                        key={aIndex}
                                        className={cn(
                                            'flex items-center gap-3 rounded-2xl p-3 pl-4 shadow-sm transition-colors',
                                            filled ? `${ANSWER_COLORS[aIndex]} text-white` : 'border border-slate-200 bg-white',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                                filled ? 'bg-black/15' : ANSWER_COLORS[aIndex],
                                            )}
                                        >
                                            <AnswerShape index={aIndex} className="h-5 w-5 text-white" />
                                        </span>
                                        <input
                                            type="text"
                                            aria-label={`Answer ${aIndex + 1}`}
                                            value={answer.answerText}
                                            onChange={(e) => updateAnswer(activeQuestionIndex, aIndex, { answerText: e.target.value })}
                                            placeholder={aIndex < 2 ? `Answer ${aIndex + 1}` : `Answer ${aIndex + 1} (optional)`}
                                            className={cn(
                                                'h-12 min-w-0 flex-1 bg-transparent text-lg font-semibold focus:outline-none',
                                                filled ? 'placeholder:text-white/60' : 'text-slate-900 placeholder:text-slate-300',
                                            )}
                                        />
                                        <button
                                            onClick={() => updateAnswer(activeQuestionIndex, aIndex, { isCorrect: !answer.isCorrect })}
                                            title={answer.isCorrect ? 'Correct answer' : 'Mark as correct'}
                                            aria-pressed={answer.isCorrect}
                                            className={cn(
                                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer',
                                                answer.isCorrect
                                                    ? filled
                                                        ? 'border-white bg-white text-emerald-600'
                                                        : 'border-emerald-500 bg-emerald-500 text-white'
                                                    : filled
                                                      ? 'border-white/70 text-transparent hover:text-white/70'
                                                      : 'border-slate-200 text-transparent hover:text-slate-300',
                                            )}
                                        >
                                            <Check className="h-5 w-5" strokeWidth={3.5} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-center text-sm text-slate-400">
                            Tick the circle next to each correct answer. Questions need 2–4 answers.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateQuiz;
