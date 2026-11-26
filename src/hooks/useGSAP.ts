import { useEffect, useRef, useCallback, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Hook for GSAP ScrollTrigger reveal animations
 */
export function useRevealAnimation(
  selector: string = '.reveal-up',
  options: {
    start?: string;
    end?: string;
    scrub?: boolean | number;
    stagger?: number;
    duration?: number;
    ease?: string;
    once?: boolean;
  } = {}
) {
  const {
    start = 'top 85%',
    end = 'bottom 20%',
    stagger = 0.1,
    duration = 0.8,
    ease = 'expo.out',
    once = true,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggersRef = useRef<ScrollTrigger[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const elements = container.querySelectorAll(selector);
      if (!elements.length) return;

      elements.forEach((el, index) => {
        gsap.set(el, { opacity: 0, y: 30 });
        
        const trigger = ScrollTrigger.create({
          trigger: el,
          start,
          end,
          once,
          onEnter: () => {
            gsap.to(el, {
              opacity: 1,
              y: 0,
              duration,
              ease,
              delay: index * stagger,
            });
          },
          onLeaveBack: once ? undefined : () => {
            gsap.to(el, { opacity: 0, y: 30, duration: 0.3 });
          },
        });
        triggersRef.current.push(trigger);
      });
    }, container);

    return () => {
      ctx.revert();
      triggersRef.current.forEach(t => t.kill());
      triggersRef.current = [];
    };
  }, [selector, start, end, stagger, duration, ease, once]);

  return containerRef;
}

/**
 * Hook for stagger children animations
 */
export function useStaggerAnimation(
  selector: string = '.stagger-item',
  options: {
    start?: string;
    stagger?: number;
    duration?: number;
    ease?: string;
    from?: 'top' | 'bottom' | 'left' | 'right';
  } = {}
) {
  const { start = 'top 90%', stagger = 0.08, duration = 0.6, ease = 'power3.out', from = 'top' } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const items = container.querySelectorAll(selector);
      if (!items.length) return;

      const fromVars = from === 'top' ? { y: 30 } : 
                       from === 'bottom' ? { y: -30 } : 
                       from === 'left' ? { x: -30 } : { x: 30 };

      gsap.set(items, { opacity: 0, ...fromVars });

      ScrollTrigger.create({
        trigger: container,
        start,
        once: true,
        onEnter: () => {
          gsap.to(items, {
            opacity: 1,
            y: 0,
            x: 0,
            duration,
            ease,
            stagger,
          });
        },
      });
    }, container);

    return () => ctx.revert();
  }, [selector, start, stagger, duration, ease, from]);

  return containerRef;
}

/**
 * Hook for parallax scroll effects
 */
export function useParallax(
  speed: number = 0.5,
  direction: 'vertical' | 'horizontal' = 'vertical'
) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        [direction === 'vertical' ? 'yPercent' : 'xPercent']: -100 * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [speed, direction]);

  return elementRef;
}

/**
 * Hook for magnetic hover effects
 */
export function useMagnetic(strength: number = 0.3) {
  const elementRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = elementRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(el, {
      x: x * strength,
      y: y * strength,
      duration: 0.3,
      ease: 'power2.out',
    });
  }, [strength]);

  const handleMouseLeave = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;

    gsap.to(el, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.5)',
    });
  }, []);

  return {
    ref: elementRef,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };
}

/**
 * Hook for text reveal animations
 */
export function useTextReveal(
  selector: string = '.text-reveal',
  options: {
    type?: 'lines' | 'words' | 'chars';
    stagger?: number;
    duration?: number;
    ease?: string;
  } = {}
) {
  const { type = 'lines', stagger = 0.03, duration = 0.8, ease = 'expo.out' } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const elements = container.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent || '';
        el.innerHTML = '';
        
        if (type === 'lines') {
          const lines = text.split('\n').filter(l => l.trim());
          lines.forEach(line => {
            const span = document.createElement('span');
            span.style.display = 'block';
            span.style.overflow = 'hidden';
            span.innerHTML = `<span style="display: inline-block; transform: translateY(100%);">${line}</span>`;
            el.appendChild(span);
          });
        } else if (type === 'words') {
          const words = text.split(' ');
          words.forEach((word, i) => {
            const span = document.createElement('span');
            span.style.display = 'inline-block';
            span.style.overflow = 'hidden';
            span.innerHTML = `<span style="display: inline-block; transform: translateY(100%);">${word}</span>`;
            el.appendChild(span);
            if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
          });
        }

        const targets = el.querySelectorAll('span > span');
        gsap.set(targets, { y: '100%' });
        
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(targets, {
              y: 0,
              duration,
              ease,
              stagger,
            });
          },
        });
      });
    }, container);

    return () => ctx.revert();
  }, [selector, type, stagger, duration, ease]);

  return containerRef;
}

/**
 * Hook for counter animations
 */
export function useCounter(
  endValue: number,
  options: {
    duration?: number;
    ease?: string;
    decimals?: number;
    prefix?: string;
    suffix?: string;
  } = {}
) {
  const { duration = 2, ease = 'power2.out', decimals = 0, prefix = '', suffix = '' } = options;
  const elementRef = useRef<HTMLSpanElement>(null);
  const obj = { value: 0 };

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    obj.value = 0;
    gsap.to(obj, {
      value: endValue,
      duration,
      ease,
      onUpdate: () => {
        if (el) {
          el.textContent = `${prefix}${obj.value.toFixed(decimals)}${suffix}`;
        }
      },
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    });
  }, [endValue, duration, ease, decimals, prefix, suffix]);

  return elementRef;
}

/**
 * Hook for reduced motion preference
 */
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}