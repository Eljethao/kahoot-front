
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Lock, User, ArrowRight, Zap } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const Register: React.FC = () => {
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await register(username, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pink-600/20 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md relative z-10 border border-white/20"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                        className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-rose-500/30"
                    >
                        <Zap className="w-8 h-8 text-white" />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Create Account</h1>
                    <p className="text-slate-500">Join the community and start creating</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        minLength={3}
                        maxLength={20}
                        pattern="[A-Za-z0-9_]+"
                        title="3–20 characters: English letters, numbers or _"
                        autoComplete="username"
                        autoCapitalize="none"
                        placeholder="e.g. kru_somchai"
                        icon={<User className="w-5 h-5" />}
                    />

                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        icon={<Lock className="w-5 h-5" />}
                    />

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        isLoading={loading}
                    >
                        Get Started <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-slate-600">
                        Already have an account?{' '}
                        <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline transition-all">
                            Sign in
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;

