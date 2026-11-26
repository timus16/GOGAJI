"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

let isClient = false;

export function ClientOnly({ 
  children, 
  fallback = null 
}: { 
  children: ReactNode | (() => ReactNode); 
  fallback?: ReactNode; 
}) {
  const [isClientState, setIsClientState] = useState(false);

  useEffect(() => {
    isClient = true;
    setIsClientState(true);
  }, []);

  if (!isClientState) {
    return <>{fallback}</>;
  }

  // Support both function-as-children and direct children
  return <>{typeof children === "function" ? children() : children}</>;
}

export function useIsClient(): boolean {
  const [isClientState, setIsClientState] = useState(false);

  useEffect(() => {
    isClient = true;
    setIsClientState(true);
  }, []);

  return isClientState;
}

export function NoSSR({ children }: { children: ReactNode }) {
  const [isClientState, setIsClientState] = useState(false);

  useEffect(() => {
    isClient = true;
    setIsClientState(true);
  }, []);

  if (!isClientState) {
    return null;
  }

  return <>{children}</>;
}
