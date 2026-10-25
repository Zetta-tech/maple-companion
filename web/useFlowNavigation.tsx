import { useCallback, useEffect, useRef } from 'react';
import { beginFlowNavigation } from './flow-navigation.js';

export function useFlowNavigation() {
  const current = useRef<ReturnType<typeof beginFlowNavigation> | null>(null);
  useEffect(() => () => current.current?.cancel(), []);
  return useCallback(() => {
    current.current?.cancel();
    current.current = beginFlowNavigation();
    return current.current;
  }, []);
}
