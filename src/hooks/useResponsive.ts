"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export function useIsMobile(breakpoint = 640): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

export function useIsTablet(breakpoint = 1024): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

export function useIsDesktop(breakpoint = 1024): boolean {
  return useMediaQuery(`(min-width: ${breakpoint}px)`);
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function usePrefersDark(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}

export function useOrientation(): "portrait" | "landscape" {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const update = () => setOrientation(window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    update();
    
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return orientation;
}

export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const update = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue("--safe-area-inset-top") || "0"),
        bottom: parseInt(style.getPropertyValue("--safe-area-inset-bottom") || "0"),
        left: parseInt(style.getPropertyValue("--safe-area-inset-left") || "0"),
        right: parseInt(style.getPropertyValue("--safe-area-inset-right") || "0"),
      });
    };
    
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return insets;
}