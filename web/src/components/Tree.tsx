import { useRef, useState } from "react";
import type { ActivityLog } from "../lib/types";
import { CATS, STAGE_SCALE, type Health, type Stage } from "../lib/scoring";
import { fmtD } from "../lib/dates";

// Each slot is one branch + one fruit. Oldest memories fill the lowest, strongest branches first.
const SLOTS: { d: string; n: [number, number]; w: number }[] = [
  { d: "M400 440 C330 430 260 410 200 360", n: [200, 360], w: 9 },
  { d: "M400 440 C470 430 540 410 600 360", n: [600, 360], w: 9 },
  { d: "M400 350 C350 330 310 300 270 250", n: [270, 250], w: 7.5 },
  { d: "M400 350 C450 330 490 300 530 250", n: [530, 250], w: 7.5 },
  { d: "M296 415 Q230 418 150 440", n: [150, 440], w: 4.5 },
  { d: "M504 415 Q570 418 650 440", n: [650, 440], w: 4.5 },
  { d: "M400 262 C375 235 350 205 320 160", n: [320, 160], w: 6 },
  { d: "M400 262 C425 235 450 205 480 160", n: [480, 160], w: 6 },
  { d: "M247 392 Q215 350 175 285", n: [175, 285], w: 4.5 },
  { d: "M553 392 Q585 350 625 285", n: [625, 285], w: 4.5 },
  { d: "M354 208 Q310 200 260 195", n: [260, 195], w: 3.8 },
  { d: "M446 208 Q490 200 540 195", n: [540, 195], w: 3.8 },
  { d: "M400 200 C400 170 400 140 400 110", n: [400, 110], w: 5 },
  { d: "M400 168 Q375 140 345 105", n: [345, 105], w: 3.4 },
  { d: "M400 168 Q425 140 455 105", n: [455, 105], w: 3.4 },
  { d: "M200 360 Q160 335 115 332", n: [115, 332], w: 3 },
  { d: "M600 360 Q640 335 685 332", n: [685, 332], w: 3 },
  { d: "M175 285 Q140 265 112 232", n: [112, 232], w: 3 },
  { d: "M625 285 Q660 265 688 232", n: [688, 232], w: 3 },
  { d: "M260 195 Q230 170 205 138", n: [205, 138], w: 3 },
  { d: "M540 195 Q570 170 595 138", n: [595, 138], w: 3 },
  { d: "M345 105 Q315 90 288 68", n: [288, 68], w: 2.6 },
  { d: "M455 105 Q485 90 512 68", n: [512, 68], w: 2.6 },
  { d: "M400 110 Q400 80 400 46", n: [400, 46], w: 2.6 },
];
export const MAX_FRUIT = SLOTS.length;
const MILESTONES = [5, 10, 15, 20, 24];
export const nextMilestone = (n: number) => MILESTONES.find((m) => m > n) ?? 24;

/** Deterministic leaf positions spread around the grown branches. */
function leafSpots(count: number, branches: number) {
  const nodes = SLOTS.slice(0, Math.max(4, branches)).map((s) => s.n);
  return Array.from({ length: count }, (_, k) => {
    const [x, y] = nodes[k % nodes.length];
    const a = (k * 137.5 * Math.PI) / 180;
    const r = 34 + (k % 3) * 9;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.8, rot: (k * 53) % 180 };
  });
}

interface Props {
  logs: ActivityLog[]; // oldest first
  stage: Stage;
  health: Health;
  mini?: boolean;
  grow?: number | null;
  highlight?: number | null;
  onFruit?: (i: number) => void;
  onBud?: () => void;
}

export function Tree({ logs, stage, health, mini, grow, highlight, onFruit, onBud }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const n = Math.min(logs.length, SLOTS.length);
  const ms = nextMilestone(logs.length);
  const scale = STAGE_SCALE[stage] * health.shrink;
  const leaves = leafSpots(health.leaves, n);

  if (stage === "Acorn" && n === 0) {
    return (
      <svg className="tree acorn" viewBox="0 0 800 620" role="img" aria-label="An acorn, waiting to sprout">
        <ellipse className="ground" cx="400" cy="604" rx="160" ry="10" />
        <g transform="translate(400 540)">
          <ellipse cx="0" cy="18" rx="34" ry="42" fill="#c8a27a" />
          <path d="M-42 -6 Q0 -40 42 -6 Q42 8 0 8 Q-42 8 -42 -6z" fill="#8b6b4a" />
          <path d="M0 -26 Q4 -40 12 -46" stroke="#8b6b4a" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  const show = (el: SVGGElement, i: number) => {
    if (!wrap.current) return;
    const wr = wrap.current.getBoundingClientRect();
    const fr = el.getBoundingClientRect();
    setTip({ x: fr.left + fr.width / 2 - wr.left, y: fr.top - wr.top, i });
  };

  const tipLog = tip ? logs[tip.i] : null;
  return (
    <div className="tree-wrap" ref={wrap} style={mini ? { margin: 0, maxWidth: "none" } : undefined}>
      <svg className={`tree${mini ? " mini" : ""}`} viewBox="0 0 800 620" xmlns="http://www.w3.org/2000/svg">
        <ellipse className="ground" cx="400" cy="604" rx="200" ry="11" />
        <g style={{ transform: `scale(${scale})`, transformOrigin: "400px 604px", transition: "transform .8s var(--ease)" }}>
          <g className="canopy" filter="url(#soft)">
            {SLOTS.slice(0, n).map((s, i) => (
              <circle key={i} cx={s.n[0]} cy={s.n[1]} r="62" />
            ))}
          </g>
          <g className="roots">
            <path d="M386 598 C370 602 350 605 322 608" />
            <path d="M414 598 C430 602 450 605 478 608" />
            <path d="M398 602 C394 607 388 611 378 614" />
          </g>
          <g className="future">
            {SLOTS.slice(n, ms).map((s, i) => (
              <path key={i} d={s.d} />
            ))}
          </g>
          <g className="branches">
            {SLOTS.slice(0, n).map((s, i) => (
              <path key={i} d={s.d} strokeWidth={s.w} pathLength={1} className={grow === i ? "grow" : ""} />
            ))}
          </g>
          <path
            className="trunk"
            d="M379 604 C389 520 385 430 393 340 C397 262 395 190 398 118 L402 118 C405 190 403 262 407 340 C415 430 411 520 421 604 Z"
          />
          <g className="leaves">
            {leaves.map((l, k) => (
              // Position/rotate on a parent <g>: the CSS pop-in animation owns the ellipse's own transform.
              <g key={k} transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}>
                <ellipse rx="13" ry="6.5" style={{ animationDelay: `${k * 30}ms` }} />
              </g>
            ))}
          </g>
          <g className="buds">
            {SLOTS.slice(n, ms).map((s, i) => (
              <g key={i} transform={`translate(${s.n[0]} ${s.n[1]})`}>
                <g className="bud" role={mini ? undefined : "button"} aria-label={mini ? undefined : "Empty branch"} onClick={onBud}>
                  <circle r="9" />
                </g>
              </g>
            ))}
          </g>
          <g className="fruits">
            {SLOTS.slice(0, n).map((s, i) => {
              const log = logs[i];
              const cls = ["fruit", grow === i ? "pop" : "", i === n - 1 ? "latest" : "", highlight === i ? "hl" : ""].join(" ");
              return (
                <g key={log.id} transform={`translate(${s.n[0]} ${s.n[1]})`}>
                  <g
                    className={cls}
                    tabIndex={mini ? undefined : 0}
                    role={mini ? undefined : "button"}
                    aria-label={mini ? undefined : log.title}
                    onMouseEnter={(e) => show(e.currentTarget, i)}
                    onFocus={(e) => show(e.currentTarget, i)}
                    onMouseLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                    onClick={() => {
                      setTip(null);
                      onFruit?.(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFruit?.(i);
                      }
                    }}
                  >
                    <circle className="halo" r="30" />
                    <circle className="fruit-bg" r="23" />
                    <text className="fruit-emoji" y="1">
                      {log.emoji || CATS[log.cat].emoji}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      {!mini && (
        <div className={`tip${tipLog ? " show" : ""}`} style={tip ? { left: tip.x, top: tip.y } : undefined}>
          {tipLog && (
            <>
              <b>{tipLog.title}</b>
              <span>
                {fmtD(tipLog.date, { month: "short", day: "numeric" })} · {CATS[tipLog.cat].label} · +{tipLog.points.total}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
