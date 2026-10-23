"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export function AnimatedCount({ value, format = (number: number) => String(number) }: {
  value: number;
  format?: (number: number) => string;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 480);
      setDisplay(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return (
    <span className="inline-block tabular-nums" style={{ minWidth: `${format(value).length}ch` }}>
      {format(reduceMotion ? value : display)}
    </span>
  );
}
