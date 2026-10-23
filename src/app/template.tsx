"use client";

import { usePathname } from "next/navigation";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { slideIn, motionTiming } from "@/lib/animations";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isStudyFlow = pathname === "/upload" || pathname.startsWith("/quiz/") || pathname.startsWith("/results/");

  return (
    <MotionConfig reducedMotion="user">
      {isStudyFlow ? (
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={motionTiming}>
          {children}
        </motion.div>
      ) : children}
    </MotionConfig>
  );
}
