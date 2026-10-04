import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { quizService } from '../../services/quizService';
import { gameService } from '../../services/gameService';
import type { Quiz } from '../../types';
import { motion } from 'framer-motion';
import {
    Plus, Play, Edit, Trash2, LogOut, Search,
    LayoutGrid, List as ListIcon,
    Trophy, Clock
} from 'lucide-react';
import { Button } from '../../components/ui/Button';


const Dashboard: React.FC = () => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [hostingQuizId, setHostingQuizId] = useState<string | null>(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadQuizzes();
    }, []);

    const loadQuizzes = async () => {
        try {
            const data = await quizService.getAll();
            setQuizzes(data);
        } catch (error) {
            console.error('Failed to load quizzes', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this quiz?')) {
            try {
                await quizService.delete(id);
                setQuizzes(quizzes.filter((q) => q.id !== id));
            } catch (error) {
                console.error('Failed to delete quiz', error);
            }
        }
    };

    // The game is created here and the host page is opened by its id, so
    // reloading the host page returns to the same game.
    const handleHost = async (quizId: string) => {
        setHostingQuizId(quizId);
        try {
            const game = await gameService.createGame(quizId);
            navigate(`/host/${game.id}`);
        } catch (error) {
            console.error('Failed to create game', error);
            alert(error instanceof Error ? error.message : 'Failed to start a game');
            setHostingQuizId(null);
        }
    };

    const filteredQuizzes = quizzes.filter(q =>
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
                            QuizMaster
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                            <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                                {user?.username?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-700">{user?.username}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={logout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Action Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">My Quizzes</h1>
                        <p className="text-slate-500">Manage and host your quiz games</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search quizzes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <Button onClick={() => navigate('/quiz/create')}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Quiz
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/play')}>
                            <Play className="w-4 h-4 mr-2" />
                            Join Game
                        </Button>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : filteredQuizzes.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <LayoutGrid className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No quizzes found</h3>
                        <p className="text-slate-500 mb-6">Get started by creating your first quiz!</p>
                        <Button onClick={() => navigate('/quiz/create')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Quiz
                        </Button>
                    </div>
                ) : (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {filteredQuizzes.map((quiz) => (
                            <motion.div
                                key={quiz.id}
                                variants={item}
                                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="h-32 bg-gradient-to-br from-violet-500 to-indigo-600 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

                                    <h3 className="text-xl font-bold text-white relative z-10 line-clamp-2">
                                        {quiz.title}
                                    </h3>
                                    <div className="absolute bottom-4 left-6 flex items-center gap-3 text-white/80 text-sm font-medium">
                                        <div className="flex items-center gap-1">
                                            <ListIcon className="w-4 h-4" />
                                            {quiz.questions.length} Qs
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            ~{Math.ceil(quiz.questions.reduce((acc, q) => acc + q.timeLimit, 0) / 60)}m
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <p className="text-slate-500 text-sm line-clamp-2 mb-6 min-h-[2.5rem]">
                                        {quiz.description || 'No description provided.'}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => handleHost(quiz.id)}
                                            isLoading={hostingQuizId === quiz.id}
                                            disabled={hostingQuizId !== null}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Host
                                        </Button>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/quiz/edit/${quiz.id}`)}
                                                className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(quiz.id)}
                                                className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
