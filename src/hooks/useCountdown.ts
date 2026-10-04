import { useCallback, useEffect, useState } from 'react';

const secondsUntil = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

// Whole seconds left until a deadline (ms since epoch). start() sets the
// count right away, so a new question never flashes the previous one's 0.
export function useCountdown() {
    const [deadline, setDeadline] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);

    const start = useCallback((newDeadline: number | null) => {
        setDeadline(newDeadline);
        setSecondsLeft(newDeadline === null ? 0 : secondsUntil(newDeadline));
    }, []);

    useEffect(() => {
        if (deadline === null) return;
        const timer = setInterval(() => setSecondsLeft(secondsUntil(deadline)), 250);
        return () => clearInterval(timer);
    }, [deadline]);

    return { secondsLeft, deadline, start };
}
