import * as React from "react";

export interface SocraticLogoProps {
  className?: string;
  size?: number;
}

export function SocraticLogo({
  className = "w-9 h-9",
  size = 40,
}: SocraticLogoProps) {
  return (
    <span
      role="img"
      aria-label="Socrix emblem"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: "url(/logo-mask.png)",
        maskImage: "url(/logo-mask.png)",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
