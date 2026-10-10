import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Play, Pencil, Trash2, LogOut, Search, ListChecks, Clock, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { quizService } from '../../services/quizService';
import { gameService } from '../../services/gameService';
import type { Quiz } from '../../types';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { AnswerShape } from '../../components/game/AnswerShape';

const STRIPE = ['bg-answer-red', 'bg-answer-blue', 'bg-answer-yellow', 'bg-answer-green'];

// Rough game length: answering time plus the intro and results screens.
const estimatedMinutes = (quiz: Quiz) =>
    Math.max(1, Math.round(quiz.questions.reduce((total, q) => total + q.timeLimit + 15, 0) / 60));

const Dashboard: React.FC = () => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [hostingQuizId, setHostingQuizId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        quizService
            .getAll()
            .then((data) => {
                if (!cancelled) setQuizzes(data);
            })
            .catch((error: unknown) => {
                console.error('Failed to load quizzes', error);
                if (!cancelled) setLoadError('Could not load your quizzes. Reload the page to try again.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!confirmDeleteId) return;
        const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
        return () => clearTimeout(timer);
    }, [confirmDeleteId]);

    const handleDelete = async (id: string) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            return;
        }
        setConfirmDeleteId(null);
        try {
            await quizService.delete(id);
            setQuizzes((current) => current.filter((q) => q.id !== id));
        } catch (error) {
            console.error('Failed to delete quiz', error);
            setLoadError('Could not delete that quiz. Try again.');
        }
    };

    // The game is created here and the host page is opened by its id, so
    // reloading the host page returns to the same game.
    const handleHost = async (quizId: string) => {
        setHostingQuizId(quizId);
        setLoadError('');
        try {
            const game = await gameService.createGame(quizId);
            navigate(`/host/${game.id}`);
        } catch (error) {
            console.error('Failed to create game', error);
            setLoadError(error instanceof Error ? error.message : 'Failed to start a game');
            setHostingQuizId(null);
        }
    };

    const term = searchTerm.trim().toLowerCase();
    const filteredQuizzes = quizzes.filter(
        (q) => q.title.toLowerCase().includes(term) || q.description?.toLowerCase().includes(term),
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Logo />
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/play')}>
                            <Gamepad2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Join a game</span>
                        </Button>
                        <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                                {user?.username?.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">{user?.username}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My quizzes</h1>
                        <p className="mt-1 text-slate-500">
                            {loading ? 'Loading…' : `${quizzes.length} ${quizzes.length === 1 ? 'quiz' : 'quizzes'} ready to host`}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-72">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                placeholder="Search quizzes"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[15px] shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                            />
                        </div>
                        <Button onClick={() => navigate('/quiz/create')} className="shrink-0">
                            <Plus className="w-4 h-4" />
                            New quiz
                        </Button>
                    </div>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                        {loadError}
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                        ))}
                    </div>
                ) : filteredQuizzes.length === 0 && loadError ? null : filteredQuizzes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
                        <div className="mx-auto mb-5 grid w-fit grid-cols-2 gap-1.5">
                            {STRIPE.map((color, index) => (
                                <span key={index} className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                                    <AnswerShape index={index} className="h-4 w-4 text-white" />
                                </span>
                            ))}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {quizzes.length === 0 ? 'Create your first quiz' : 'No quizzes match your search'}
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-slate-500">
                            {quizzes.length === 0
                                ? 'Add a few questions, then host it live for your players.'
                                : 'Try a different word, or clear the search.'}
                        </p>
                        {quizzes.length === 0 && (
                            <Button onClick={() => navigate('/quiz/create')} className="mt-6">
                                <Plus className="w-4 h-4" />
                                New quiz
                            </Button>
                        )}
                    </div>
                ) : (
                    <motion.ul
                        initial="hidden"
                        animate="show"
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                        className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
                    >
                        {filteredQuizzes.map((quiz) => (
                            <motion.li
                                key={quiz.id}
                                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-900/5"
                            >
                                <div className="flex h-1.5">
                                    {STRIPE.map((color) => (
                                        <span key={color} className={`flex-1 ${color}`} />
                                    ))}
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900">{quiz.title}</h3>
                                    <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
                                        {quiz.description || 'No description'}
                                    </p>
                                    <div className="mt-4 flex items-center gap-4 text-sm font-medium text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <ListChecks className="h-4 w-4" />
                                            {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="h-4 w-4" />~{estimatedMinutes(quiz)} min
                                        </span>
                                    </div>

                                    <div className="mt-5 flex items-center gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => handleHost(quiz.id)}
                                            isLoading={hostingQuizId === quiz.id}
                                            disabled={hostingQuizId !== null}
                                        >
                                            {hostingQuizId !== quiz.id && <Play className="h-4 w-4 fill-current" />}
                                            Host
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => navigate(`/quiz/edit/${quiz.id}`)}
                                            title="Edit"
                                            className="px-3"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant={confirmDeleteId === quiz.id ? 'danger' : 'secondary'}
                                            onClick={() => handleDelete(quiz.id)}
                                            title="Delete"
                                            className="px-3"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            {confirmDeleteId === quiz.id && 'Delete?'}
                                        </Button>
                                    </div>
                                </div>
                            </motion.li>
                        ))}
                    </motion.ul>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
