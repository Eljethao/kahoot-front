import React, { useState } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#f5b700', '#ffffff', '#a78bfa'];

interface Piece {
    id: number;
    left: number;
    size: number;
    color: string;
    round: boolean;
    drift: number;
    spin: number;
    delay: number;
    duration: number;
}

function makePieces(count: number, delay: number, waves: number): Piece[] {
    return Array.from({ length: count * waves }, (_, id) => ({
        id,
        left: Math.random() * 100,
        size: 7 + Math.random() * 8,
        color: COLORS[id % COLORS.length],
        round: Math.random() < 0.3,
        drift: (Math.random() - 0.5) * 24,
        spin: (Math.random() - 0.5) * 1080,
        delay: delay + Math.floor(id / count) * 1.6 + Math.random() * 1.4,
        duration: 2.8 + Math.random() * 2.4,
    }));
}

// Confetti falling over the whole screen, in a few waves.
export const Confetti: React.FC<{ count?: number; delay?: number; waves?: number }> = ({
    count = 90,
    delay = 0,
    waves = 3,
}) => {
    const [pieces] = useState(() => makePieces(count, delay, waves));

    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            {pieces.map((piece) => (
                <motion.div
                    key={piece.id}
                    className="absolute top-0"
                    style={{
                        left: `${piece.left}%`,
                        width: piece.size,
                        height: piece.round ? piece.size : piece.size * 0.45,
                        backgroundColor: piece.color,
                        borderRadius: piece.round ? '9999px' : '2px',
                    }}
                    initial={{ y: '-5vh', x: 0, rotate: 0, opacity: 1 }}
                    animate={{ y: '105vh', x: `${piece.drift}vw`, rotate: piece.spin, opacity: [1, 1, 0.7] }}
                    transition={{ duration: piece.duration, delay: piece.delay, ease: [0.25, 0.1, 0.6, 1] }}
                />
            ))}
        </div>
    );
};
