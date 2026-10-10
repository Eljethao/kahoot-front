import React from 'react';
import { cn } from '../../lib/utils';
import { AnswerShape } from '../game/AnswerShape';

const SHAPE_COLORS = ['text-answer-red', 'text-answer-blue', 'text-answer-yellow', 'text-answer-green'];

// The four answer shapes in a tile, with the app name.
export const Logo: React.FC<{ className?: string; showName?: boolean; inverted?: boolean }> = ({
    className,
    showName = true,
    inverted = false,
}) => (
    <div className={cn('flex items-center gap-2.5', className)}>
        <div className={cn('grid grid-cols-2 gap-0.5 rounded-xl p-1.5 shadow-sm', inverted ? 'bg-white' : 'bg-game-800')}>
            {SHAPE_COLORS.map((color, index) => (
                <AnswerShape key={index} index={index} className={cn('w-3 h-3', color)} />
            ))}
        </div>
        {showName && (
            <span className={cn('text-lg font-extrabold tracking-tight', inverted ? 'text-white' : 'text-slate-900')}>
                QuizMaster
            </span>
        )}
    </div>
);
