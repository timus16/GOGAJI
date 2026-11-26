"use client";

import { useEffect, useRef, useState } from 'react';

interface Star {
 x: number;
 y: number;
 z: number;
 r: number;
 base: number;
 twinkle: number;
 hue: number;
}

export default function Starfield({
 density = 1,
 className = '',
 parallax = true,
}: {
 density?: number;
 className?: string;
 parallax?: boolean;
}) {
 const ref = useRef<HTMLCanvasElement | null>(null);
 const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
 const [mounted, setMounted] = useState(false);

 useEffect(() => {
 setMounted(true);
 const canvas = ref.current;
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 let w = 0;
 let h = 0;
 let dpr = 1;
 let stars = [];
 let raf = 0;
 let t = 0;
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

 const build = () => {
 const rect = canvas.getBoundingClientRect();
 dpr = Math.min(window.devicePixelRatio || 1, 2);
 w = Math.max(1, Math.floor(rect.width));
 h = Math.max(1, Math.floor(rect.height));
 canvas.width = w * dpr;
 canvas.height = h * dpr;
 ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

 const count = Math.floor(((w * h) / 5200) * density);
 stars = Array.from({ length: count }, () => {
 const z = Math.random();
 return {
 x: Math.random() * w,
 y: Math.random() * h,
 z,
 r: 0.25 + z * 1.35,
 base: 0.22 + z * 0.62,
 twinkle: Math.random() * Math.PI * 2,
 hue: Math.random(),
 };
 });
 };

 const draw = () => {
 t += reduced ? 0 : 0.0055;
 pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.045;
 pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.045;

 ctx.clearRect(0, 0, w, h);

 for (const s of stars) {
 const tw = 0.65 + 0.35 * Math.sin(t * 2.1 + s.twinkle);
 const drift = s.z * (reduced ? 0 : 0.055);
 const px = s.x + drift * t * 12 + (parallax ? pointer.current.x * s.z * 26 : 0);
 const py = s.y + drift * t * 4 + (parallax ? pointer.current.y * s.z * 26 : 0);

 const x = ((px % w) + w) % w;
 const y = ((py % h) + h) % h;

 const a = s.base * tw;
 const warm = s.hue > 0.82;
 ctx.fillStyle = warm
 ? 'rgba(232,181,102,' + a + ')'
 : s.hue < 0.16
 ? 'rgba(127,180,214,' + a + ')'
 : 'rgba(230,227,220,' + a + ')';
 ctx.beginPath();
 ctx.arc(x, y, s.r, 0, Math.PI * 2);
 ctx.fill();

 if (s.z > 0.93) {
 ctx.globalAlpha = a * 0.35;
 ctx.fillRect(x - s.r * 3.2, y - 0.35, s.r * 6.4, 0.7);
 ctx.globalAlpha = 1;
 }
 }

 raf = requestAnimationFrame(draw);
 };

 const onPointer = (e) => {
 const rect = canvas.getBoundingClientRect();
 pointer.current.tx = (e.clientX - rect.left) / rect.width - 0.5;
 pointer.current.ty = (e.clientY - rect.top) / rect.height - 0.5;
 };

 build();
 draw();

 const ro = new ResizeObserver(build);
 ro.observe(canvas);
 if (parallax) window.addEventListener('pointermove', onPointer);

 return () => {
 cancelAnimationFrame(raf);
 ro.disconnect();
 window.removeEventListener('pointermove', onPointer);
 };
 }, [density, parallax]);

 if (!mounted) return null;

 return <canvas ref={ref} className={className} aria-hidden='true' />;
}
