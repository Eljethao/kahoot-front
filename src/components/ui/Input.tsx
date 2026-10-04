import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon, ...props }, ref) => {
        return (
            <div className="w-full space-y-2">
                {label && (
                    <label className="text-sm font-medium text-slate-700 ml-1">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            'flex h-11 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-2 text-sm text-slate-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
                            icon && 'pl-10',
                            error && 'border-red-500 focus-visible:ring-red-500/50 focus-visible:border-red-500',
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-sm text-red-500 ml-1 animate-in slide-in-from-top-1 fade-in">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
