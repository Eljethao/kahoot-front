import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends HTMLMotionProps<"button"> {
    // light and glass are for the dark game screens.
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'light' | 'glass';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isLoading?: boolean;
    children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        const variants = {
            primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-900/10 border-transparent',
            secondary: 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200 shadow-sm',
            outline: 'bg-transparent border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent',
            danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm border-transparent',
            light: 'bg-white text-game-900 hover:bg-white/90 shadow-lg shadow-black/20 border-transparent',
            glass: 'bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-sm',
        };

        const sizes = {
            sm: 'h-9 px-3.5 text-sm gap-1.5',
            md: 'h-11 px-5 text-[15px] gap-2',
            lg: 'h-13 px-7 text-base gap-2',
            xl: 'h-16 px-10 text-xl gap-3',
        };

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.97 }}
                className={cn(
                    'relative inline-flex items-center justify-center rounded-xl font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border cursor-pointer select-none',
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {children as React.ReactNode}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
