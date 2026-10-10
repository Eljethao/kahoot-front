import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// Big, faint answer shapes drifting behind the game screens.
const SHAPES = [
    { className: 'left-[-6%] top-[8%] w-72 h-72 rounded-[3rem]', duration: 60 },
    { className: 'right-[-8%] top-[30%] w-96 h-96 rounded-full', duration: 80 },
    { className: 'left-[20%] bottom-[-12%] w-80 h-80 rounded-[3rem]', duration: 70 },
];

export const GameBackground: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn('relative min-h-screen overflow-hidden bg-game-900 text-white', className)}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-game-700),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--color-game-950),transparent_70%)]" />
        {SHAPES.map((shape, index) => (
            <motion.div
                key={index}
                aria-hidden
                className={cn('pointer-events-none absolute bg-white/[0.04]', shape.className)}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: shape.duration, ease: 'linear' }}
            />
        ))}
        <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
    </div>
);
