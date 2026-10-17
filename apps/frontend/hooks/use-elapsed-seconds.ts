'use client';

import { useEffect, useRef, useState } from 'react';

/** Tick elapsed whole seconds while `active` is true; resets when inactive. */
export function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = null;
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [active]);

  return elapsed;
}
