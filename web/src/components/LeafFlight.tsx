import { useLayoutEffect, useRef } from "react";

/** A point on screen (viewport px) and the width of the thing drawn there. */
export interface Spot {
  x: number;
  y: number;
  size: number;
}

export interface Flyer {
  id: string;
  emoji: string;
  mine: boolean;
  from: Spot;
  to: Spot;
}

/** Map pins are this wide (see .map-leaf). Flyers are drawn at this size and scaled. */
export const PIN = 34;
const DURATION = 850;
const STAGGER = 28;
const MAX_DELAY = 420;

/** Center and width of an element, or null when it isn't laid out (hidden, unplaced). */
export function spotOf(el: Element | null, size?: number): Spot | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: size ?? r.width };
}

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Hangout icons flying between the tree and the map. "map" turns each round fruit
 * into a leaf-shaped pin on the way; "tree" plays it backwards.
 */
export function LeafFlight({ flyers, dir, onDone }: { flyers: Flyer[]; dir: "map" | "tree"; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useLayoutEffect(() => {
    const els = root.current ? [...root.current.querySelectorAll<HTMLElement>(".flyer")] : [];
    const anims = els.flatMap((el, i) => {
      const f = flyers[i];
      // Round fruit on the tree, leaf pin on the map.
      const fruit = { at: dir === "map" ? f.from : f.to, radius: "50%", spin: 0, bg: "#fff" };
      const pin = { at: dir === "map" ? f.to : f.from, radius: "50% 50% 50% 6px", spin: -45, bg: f.mine ? "#6fa84e" : "#c9d6bf" };
      const [a, b] = dir === "map" ? [fruit, pin] : [pin, fruit];
      const lift = Math.min(90, Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y) * 0.25);
      const frame = (s: typeof a, extra = 0) => ({
        transform: `translate(${s.at.x}px, ${s.at.y - extra}px) scale(${s.at.size / PIN}) rotate(${s.spin}deg)`,
        borderRadius: s.radius,
        backgroundColor: s.bg,
      });
      const mid = {
        transform: `translate(${(a.at.x + b.at.x) / 2}px, ${(a.at.y + b.at.y) / 2 - lift}px) scale(${(a.at.size + b.at.size) / 2 / PIN}) rotate(${(a.spin + b.spin) / 2}deg)`,
      };
      const opts: KeyframeAnimationOptions = { duration: DURATION, delay: Math.min(i * STAGGER, MAX_DELAY), easing: "cubic-bezier(.45,0,.2,1)", fill: "both" };
      const emoji = el.firstElementChild as HTMLElement;
      return [el.animate([frame(a), mid, frame(b)], opts), emoji.animate([{ transform: `rotate(${-a.spin}deg)` }, { transform: `rotate(${-b.spin}deg)` }], opts)];
    });
    let live = true;
    Promise.all(anims.map((a) => a.finished)).then(
      () => live && done.current(),
      () => live && done.current(),
    );
    return () => {
      live = false;
      anims.forEach((a) => a.cancel());
    };
  }, [flyers, dir]);

  return (
    <div ref={root} className="leaf-flight" aria-hidden>
      {flyers.map((f) => (
        <span key={f.id} className={`flyer${f.mine ? "" : " faded"}`}>
          <i>{f.emoji}</i>
        </span>
      ))}
    </div>
  );
}
