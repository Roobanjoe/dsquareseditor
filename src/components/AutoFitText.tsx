import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  /** Max height of the box; if omitted, single-line height is used. */
  maxHeight?: number;
  /** Allow multi-line wrapping. */
  wrap?: boolean;
  /** Minimum font size to shrink to before clipping. */
  minFontSize?: number;
};

/**
 * Renders text inside a fixed bounding box. If the text overflows, it first
 * wraps (when `wrap` is true), then shrinks font-size down to `minFontSize`
 * until it fits. The box position and width never change — only the text
 * inside adapts. This keeps other fields anchored to their template slots.
 */
export function AutoFitText({
  text,
  x,
  y,
  width,
  fontSize,
  color,
  fontWeight,
  align,
  maxHeight,
  wrap = false,
  minFontSize = 10,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fontSize);

  const boxHeight = maxHeight ?? Math.ceil(fontSize * 1.25);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let current = fontSize;
    el.style.fontSize = `${current}px`;
    // Shrink until content fits both width (no horizontal overflow when not
    // wrapping) and height (when wrapping into multi-line).
    const fits = () =>
      el.scrollHeight <= boxHeight + 0.5 &&
      (wrap ? true : el.scrollWidth <= width + 0.5);
    while (!fits() && current > minFontSize) {
      current -= 0.5;
      el.style.fontSize = `${current}px`;
    }
    setSize(current);
  }, [text, fontSize, width, boxHeight, wrap, minFontSize]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: boxHeight,
        fontSize: size,
        color,
        fontWeight,
        textAlign: align,
        lineHeight: 1.2,
        whiteSpace: wrap ? "normal" : "nowrap",
        wordBreak: wrap ? "break-word" : "normal",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ display: "block", width: "100%", textAlign: align }}>{text}</span>
    </div>
  );
}
