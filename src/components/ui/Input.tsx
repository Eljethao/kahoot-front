import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, icon, id, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id ?? generatedId;

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={cn(
                            'flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 shadow-sm shadow-slate-900/[0.02] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150',
                            icon && 'pl-11',
                            error && 'border-red-400 focus-visible:ring-red-500/15 focus-visible:border-red-500',
                            className
                        )}
                        {...props}
                    />
                </div>
                {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : (
                    hint && <p className="text-xs text-slate-500">{hint}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
