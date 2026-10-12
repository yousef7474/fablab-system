import React, { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './siteCore';

// Fixed, full-viewport animated star background (twinkling + slow drift),
// like the old site. Pauses when the tab is hidden; draws a single static
// frame when the visitor prefers reduced motion.
const StarField = ({ density = 1 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const reduced = prefersReducedMotion();
    let stars = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(220, (w * h) / 9000) * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random(),
        da: (Math.random() * 0.012 + 0.003) * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.random() * 0.12 + 0.02,
        hue: Math.random() < 0.15 ? 290 : (Math.random() < 0.2 ? 200 : 0)
      }));
    };

    const draw = (animate) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (animate) {
          s.a += s.da;
          if (s.a <= 0.15 || s.a >= 1) s.da *= -1;
          s.y += s.vy;
          if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue
          ? `hsla(${s.hue}, 90%, 75%, ${Math.max(0.1, s.a)})`
          : `rgba(255, 255, 255, ${Math.max(0.1, s.a)})`;
        ctx.fill();
      }
    };

    const loop = () => {
      draw(true);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => { resize(); if (reduced) draw(false); };

    resize();
    draw(false);
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="site-stars" aria-hidden="true" />;
};

export default StarField;
