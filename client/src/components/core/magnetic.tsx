import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type MagneticProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
  maxOffset?: number;
};

/** Adds a restrained pointer-follow effect to .button descendants on fine pointers. */
export function Magnetic({ children, className = "", strength = 0.14, maxOffset = 5 }: MagneticProps) {
  const activeButton = useRef<HTMLElement | null>(null);

  const reset = () => {
    activeButton.current?.style.setProperty("--magnetic-x", "0px");
    activeButton.current?.style.setProperty("--magnetic-y", "0px");
    activeButton.current = null;
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".button") : null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (event.pointerType === "touch" || reducedMotion || !target || !event.currentTarget.contains(target) || target.matches(":disabled, [aria-disabled='true']")) {
      reset();
      return;
    }

    if (activeButton.current !== target) {
      reset();
      activeButton.current = target;
    }

    const rect = target.getBoundingClientRect();
    const previousX = Number.parseFloat(target.style.getPropertyValue("--magnetic-x")) || 0;
    const previousY = Number.parseFloat(target.style.getPropertyValue("--magnetic-y")) || 0;
    const centerX = rect.left + rect.width / 2 - previousX;
    const centerY = rect.top + rect.height / 2 - previousY;
    const offsetX = Math.max(-maxOffset, Math.min(maxOffset, (event.clientX - centerX) * strength));
    const offsetY = Math.max(-maxOffset, Math.min(maxOffset, (event.clientY - centerY) * strength));

    target.style.setProperty("--magnetic-x", `${offsetX.toFixed(2)}px`);
    target.style.setProperty("--magnetic-y", `${offsetY.toFixed(2)}px`);
  };

  return <div className={className} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>{children}</div>;
}
