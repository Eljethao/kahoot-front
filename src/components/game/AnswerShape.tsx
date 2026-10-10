import React from 'react';
import { cn } from '../../lib/utils';

// Triangle, diamond, circle, square: the shape for each answer slot.
export const AnswerShape: React.FC<{ index: number; className?: string }> = ({ index, className }) => (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('fill-current drop-shadow-sm', className)}>
        {index === 0 && <path d="M12 3.5 22 20.5H2Z" />}
        {index === 1 && <path d="M12 2 22 12 12 22 2 12Z" />}
        {index === 2 && <circle cx="12" cy="12" r="9.5" />}
        {index === 3 && <rect x="3" y="3" width="18" height="18" rx="1.5" />}
    </svg>
);
