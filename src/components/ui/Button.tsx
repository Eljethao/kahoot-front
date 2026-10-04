import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        const variants = {
            primary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-indigo-500/30 border-transparent',
            secondary: 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200 shadow-sm',
            outline: 'bg-transparent border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
            danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 border-transparent',
        };

        const sizes = {
            sm: 'h-9 px-4 text-sm',
            md: 'h-11 px-6 text-base',
            lg: 'h-14 px-8 text-lg',
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    'relative inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:pointer-events-none border',
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {children as React.ReactNode}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
