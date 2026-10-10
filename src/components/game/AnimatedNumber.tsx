import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// Counts from the number currently shown to `value` whenever `value` changes.
export const AnimatedNumber: React.FC<{ value: number; duration?: number; delay?: number; className?: string }> = ({
    value,
    duration = 1,
    delay = 0,
    className,
}) => {
    const [display, setDisplay] = useState(value);
    const shown = useRef(value);

    useEffect(() => {
        const controls = animate(shown.current, value, {
            duration,
            delay,
            ease: 'easeOut',
            onUpdate: (latest) => {
                shown.current = latest;
                setDisplay(Math.round(latest));
            },
        });
        return () => controls.stop();
    }, [value, duration, delay]);

    return <span className={`tabular ${className ?? ''}`}>{display.toLocaleString()}</span>;
};
