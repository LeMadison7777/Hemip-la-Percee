import type { ElementType } from "react";

type TextEffectProps = {
  children: string;
  per?: "word";
  as?: ElementType;
  preset?: "slide";
  className?: string;
  staggerMs?: number;
};

/** Lightweight word-by-word text entrance, styled by the HEMIP theme. */
export function TextEffect({
  children,
  per = "word",
  as: Component = "h3",
  preset = "slide",
  className = "",
  staggerMs = 70,
}: TextEffectProps) {
  let wordIndex = 0;
  const words = per === "word" ? children.split(/(\s+)/) : [children];

  return (
    <Component className={`text-effect text-effect--${preset} ${className}`.trim()} aria-label={children}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) return word;
        const delay = wordIndex++ * staggerMs;
        return (
          <span className="text-effect-word" aria-hidden="true" style={{ animationDelay: `${delay}ms` }} key={`${word}-${index}`}>
            {word}
          </span>
        );
      })}
    </Component>
  );
}
