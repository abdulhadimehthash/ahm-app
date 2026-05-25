import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface UndoItem {
  label: string;
  onRestore: () => Promise<void> | void;
  onConfirmDelete: () => Promise<void> | void;
}

interface UndoCtx {
  showUndo: (item: UndoItem) => void;
  restore: () => void;
  activeLabel: string | null;
  secondsLeft: number;
}

const UndoContext = createContext<UndoCtx | null>(null);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const pendingRef = useRef<UndoItem | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    deleteTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const restore = useCallback(async () => {
    clearTimers();
    const item = pendingRef.current;
    pendingRef.current = null;
    setActiveLabel(null);
    setSecondsLeft(10);
    if (item) await item.onRestore();
  }, [clearTimers]);

  const showUndo = useCallback((item: UndoItem) => {
    // Execute immediately without timers or state changes
    item.onConfirmDelete();
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo, restore, activeLabel, secondsLeft }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be inside UndoProvider');
  return ctx;
}
