import React from 'react';
import { motion } from 'framer-motion';
import { AnswerShape } from './game/AnswerShape';
import { Logo } from './ui/Logo';

const SHAPES = [
    { index: 0, color: 'text-answer-red', className: 'left-[12%] top-[14%] w-24 h-24', rotate: -12 },
    { index: 1, color: 'text-answer-blue', className: 'right-[14%] top-[22%] w-20 h-20', rotate: 8 },
    { index: 2, color: 'text-answer-yellow', className: 'left-[44%] top-[46%] w-16 h-16', rotate: 0 },
    { index: 3, color: 'text-answer-green', className: 'right-[16%] bottom-[12%] w-24 h-24', rotate: 14 },
];

// Sign-in and sign-up: a brand panel on the left (wide screens), the form on the right.
export const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
    title,
    subtitle,
    children,
}) => (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-game-800 lg:flex lg:flex-col lg:justify-between p-12 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-game-700),transparent_60%)]" />
            {SHAPES.map((shape) => (
                <motion.div
                    key={shape.index}
                    className={`absolute ${shape.className} ${shape.color}`}
                    initial={{ rotate: shape.rotate, y: 0 }}
                    animate={{ y: [0, -14, 0] }}
                    transition={{ repeat: Infinity, duration: 5 + shape.index, ease: 'easeInOut' }}
                >
                    <AnswerShape index={shape.index} className="w-full h-full" />
                </motion.div>
            ))}
            <Logo inverted className="relative" />
            <div className="relative max-w-md">
                <h2 className="text-4xl font-extrabold leading-tight">Make learning loud.</h2>
                <p className="mt-4 text-lg text-white/70">
                    Build a quiz in minutes, put the PIN on the big screen and watch the scoreboard come alive.
                </p>
            </div>
        </div>

        <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                <Logo className="mb-10 lg:hidden" />
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
                <p className="mt-2 text-slate-500">{subtitle}</p>
                <div className="mt-8">{children}</div>
            </motion.div>
        </div>
    </div>
);
