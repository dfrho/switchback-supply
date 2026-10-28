import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * A small in-app log of flag change events, shown in the Release Console so a
 * reviewer can watch the listener fire in real time.
 */
export interface ReleaseEvent {
  id: number;
  at: Date;
  flagKey: string;
  value: unknown;
  note: string;
}

interface ReleaseLogValue {
  events: ReleaseEvent[];
  logEvent: (event: Omit<ReleaseEvent, 'id' | 'at'>) => void;
}

const ReleaseLogContext = createContext<ReleaseLogValue | null>(null);

let nextId = 1;

export function ReleaseLogProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ReleaseEvent[]>([]);

  const logEvent = useCallback((event: Omit<ReleaseEvent, 'id' | 'at'>) => {
    setEvents((prev) => [{ ...event, id: nextId++, at: new Date() }, ...prev].slice(0, 25));
  }, []);

  const value = useMemo(() => ({ events, logEvent }), [events, logEvent]);
  return <ReleaseLogContext.Provider value={value}>{children}</ReleaseLogContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook co-located with its provider
export function useReleaseLog(): ReleaseLogValue {
  const value = useContext(ReleaseLogContext);
  if (!value) throw new Error('useReleaseLog must be used inside ReleaseLogProvider');
  return value;
}
