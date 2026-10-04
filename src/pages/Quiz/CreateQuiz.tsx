import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizService } from '../../services/quizService';
import type { CreateQuizDto } from '../../types';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Save, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ANSWER_COLORS, ANSWER_SHAPES } from '../../lib/answerStyles';

type QuestionDraft = CreateQuizDto['questions'][number];
type AnswerDraft = QuestionDraft['answers'][number];

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

const CreateQuiz: React.FC = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description] = useState('');
    const [questions, setQuestions] = useState<CreateQuizDto['questions']>([
        {
            questionText: '',
            timeLimit: 20,
            points: 1000,
            order: 1,
            answers: [
                { answerText: '', isCorrect: false, order: 1 },
                { answerText: '', isCorrect: false, order: 2 },
                { answerText: '', isCorrect: false, order: 3 },
                { answerText: '', isCorrect: false, order: 4 },
            ],
        },
    ]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddQuestion = () => {
        setQuestions([
            ...questions,
            {
                questionText: '',
                timeLimit: 20,
                points: 1000,
                order: questions.length + 1,
                answers: [
                    { answerText: '', isCorrect: false, order: 1 },
                    { answerText: '', isCorrect: false, order: 2 },
                    { answerText: '', isCorrect: false, order: 3 },
                    { answerText: '', isCorrect: false, order: 4 },
                ],
            },
        ]);
        setActiveQuestionIndex(questions.length);
    };

    const handleQuestionChange = <K extends keyof QuestionDraft>(index: number, field: K, value: QuestionDraft[K]) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setQuestions(newQuestions);
        setError('');
    };

    const handleAnswerChange = <K extends keyof AnswerDraft>(
        qIndex: number,
        aIndex: number,
        field: K,
        value: AnswerDraft[K]
    ) => {
        const newQuestions = [...questions];
        const answers = [...newQuestions[qIndex].answers];
        answers[aIndex] = { ...answers[aIndex], [field]: value };
        newQuestions[qIndex] = { ...newQuestions[qIndex], answers };
        setQuestions(newQuestions);
        setError('');
    };

    const handleRemoveQuestion = (index: number) => {
        if (questions.length === 1) return;
        const newQuestions = questions.filter((_, i) => i !== index);
        setQuestions(newQuestions);
        if (activeQuestionIndex >= newQuestions.length) {
            setActiveQuestionIndex(newQuestions.length - 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const problem = findProblem(questions);
        if (problem) {
            setActiveQuestionIndex(problem.index);
            setError(problem.message);
            return;
        }

        setLoading(true);
        try {
            await quizService.create({
                title: title.trim(),
                description,
                questions: toSave(questions),
            });
            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to create quiz', err);
            setError(err instanceof Error ? err.message : 'Failed to create quiz');
        } finally {
            setLoading(false);
        }
    };

    const activeQuestion = questions[activeQuestionIndex];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Back
                        </Button>
                        <div className="h-6 w-px bg-slate-200" />
                        <input
                            type="text"
                            placeholder="Enter quiz title..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-xl font-bold bg-transparent border-none focus:ring-0 placeholder:text-slate-300 w-64 md:w-96"
                        />
                    </div>
                    <Button onClick={handleSubmit} isLoading={loading} disabled={!title.trim()}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Quiz
                    </Button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Sidebar - Question List */}
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 space-y-3">
                        {questions.map((q, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-3 rounded-xl border cursor-pointer transition-all relative group ${activeQuestionIndex === index
                                    ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200'
                                    : 'bg-white border-slate-200 hover:border-indigo-200'
                                    }`}
                                onClick={() => setActiveQuestionIndex(index)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                    {questions.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveQuestion(index);
                                            }}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-slate-700 line-clamp-2 min-h-[2.5rem]">
                                    {q.questionText || 'New Question'}
                                </p>
                            </motion.div>
                        ))}

                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={handleAddQuestion}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Question
                        </Button>
                    </div>
                </aside>

                {/* Main Content - Question Editor */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {/* Question Input */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <textarea
                                value={activeQuestion.questionText}
                                onChange={(e) =>
                                    handleQuestionChange(activeQuestionIndex, 'questionText', e.target.value)
                                }
                                placeholder="Start typing your question..."
                                className="w-full text-3xl font-bold text-center border-none focus:ring-0 placeholder:text-slate-300 resize-none bg-transparent"
                                rows={2}
                            />
                        </div>

                        {/* Settings */}
                        <div className="flex justify-center gap-4">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <Clock className="w-5 h-5 text-indigo-500" />
                                <select
                                    value={activeQuestion.timeLimit}
                                    onChange={(e) =>
                                        handleQuestionChange(activeQuestionIndex, 'timeLimit', Number(e.target.value))
                                    }
                                    className="border-none focus:ring-0 text-sm font-medium text-slate-700 bg-transparent cursor-pointer"
                                >
                                    <option value={10}>10 seconds</option>
                                    <option value={20}>20 seconds</option>
                                    <option value={30}>30 seconds</option>
                                    <option value={60}>60 seconds</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <HelpCircle className="w-5 h-5 text-indigo-500" />
                                <select
                                    value={activeQuestion.points}
                                    onChange={(e) =>
                                        handleQuestionChange(activeQuestionIndex, 'points', Number(e.target.value))
                                    }
                                    className="border-none focus:ring-0 text-sm font-medium text-slate-700 bg-transparent cursor-pointer"
                                >
                                    <option value={1000}>Standard (1000 pts)</option>
                                    <option value={2000}>Double (2000 pts)</option>
                                    <option value={0}>No points</option>
                                </select>
                            </div>
                        </div>

                        {/* Answers Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {activeQuestion.answers.map((answer, aIndex) => (
                                <div
                                    key={aIndex}
                                    className={`relative group rounded-2xl transition-all duration-200 p-1 ${answer.isCorrect
                                        ? 'bg-green-500 shadow-lg shadow-green-500/20 scale-[1.02]'
                                        : 'bg-white shadow-sm border border-slate-200 hover:border-indigo-300'
                                        }`}
                                >
                                    <div className={`h-full rounded-xl overflow-hidden flex flex-col ${answer.isCorrect ? 'bg-green-500' : 'bg-white'
                                        }`}>
                                        <div className="flex-1 p-4 flex items-center">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 font-bold text-white shadow-sm ${ANSWER_COLORS[aIndex]
                                                }`}>
                                                {ANSWER_SHAPES[aIndex]}
                                            </div>
                                            <input
                                                type="text"
                                                value={answer.answerText}
                                                onChange={(e) =>
                                                    handleAnswerChange(activeQuestionIndex, aIndex, 'answerText', e.target.value)
                                                }
                                                placeholder={aIndex < 2 ? `Answer ${aIndex + 1}` : `Answer ${aIndex + 1} (optional)`}
                                                className={`w-full bg-transparent border-none focus:ring-0 text-lg font-medium ${answer.isCorrect ? 'text-white placeholder:text-green-100' : 'text-slate-900 placeholder:text-slate-300'
                                                    }`}
                                            />
                                        </div>

                                        <button
                                            onClick={() =>
                                                handleAnswerChange(
                                                    activeQuestionIndex,
                                                    aIndex,
                                                    'isCorrect',
                                                    !answer.isCorrect
                                                )
                                            }
                                            className={`w-full py-2 px-4 flex items-center justify-center gap-2 transition-colors ${answer.isCorrect
                                                ? 'bg-green-600 text-white hover:bg-green-700'
                                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                }`}
                                        >
                                            {answer.isCorrect ? (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" /> Correct Answer
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-4 h-4 rounded-full border-2 border-slate-300" /> Mark as Correct
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateQuiz;
