import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../lib/logger';

interface SafeActionOptions {
  key: string;
  timeoutMs?: number;
  preventDoubleExecution?: boolean;
}

export function useSafeAction() {
  const activeActions = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeActions.current.clear();
    };
  }, []);

  const executeSafeAction = useCallback(async <T,>(
    actionFn: () => Promise<T> | T,
    options: SafeActionOptions
  ): Promise<T | undefined> => {
    const { key, preventDoubleExecution = true, timeoutMs = 15000 } = options;

    if (preventDoubleExecution && activeActions.current.has(key)) {
      logger.debug(`[useSafeAction] Action '${key}' is already in progress. Ignoring duplicate trigger.`);
      return undefined;
    }

    if (preventDoubleExecution) {
      activeActions.current.add(key);
    }

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      if (timeoutMs > 0) {
        // Enforce a maximum time an action can be locked to prevent permanent deadlocks
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Action '${key}' timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        return await Promise.race([actionFn(), timeoutPromise]) as T;
      } else {
        return await actionFn();
      }
    } catch (error) {
      logger.error(`[useSafeAction] Error executing action '${key}':`, error);
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (preventDoubleExecution) {
        activeActions.current.delete(key);
      }
    }
  }, []);

  const isActionExecuting = useCallback((key: string) => {
    return activeActions.current.has(key);
  }, []);

  return { executeSafeAction, isActionExecuting };
}
