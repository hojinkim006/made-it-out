import { useRef, useState } from "react";
import type { ActivityLog } from "../lib/types";
import { catInfo, type Health, type Stage } from "../lib/scoring";
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
/** Draw size of hangout icons and leaves, relative to the original artwork. */
const FRUIT_SIZE = 1.2;
const LEAF_SIZE = 1.15;
/** Smallest a tree with branches is drawn, as a share of full size. */
const MIN_SIZE = 0.55;

/**
 * How big the tree is drawn for a number of hangouts. Each one makes it bigger,
 * fastest early on, until every branch is filled. No empty branches are shown.
 */
export function growthScale(n: number) {
  const filled = Math.min(Math.max(n, 0), MAX_FRUIT) / MAX_FRUIT;
  return MIN_SIZE + (1 - MIN_SIZE) * Math.sqrt(filled);
}

/** How much the trunk thickens and the whole tree reaches, by how often the group gets out. */
const GIRTH: Record<Health["status"], number> = {
  Thriving: 1.18,
  Healthy: 1.08,
  Quiet: 1,
  Wilting: 0.86,
  Dormant: 0.74,
  New: 0.88,
};
const REACH: Record<Health["status"], number> = {
  Thriving: 1.08,
  Healthy: 1.03,
  Quiet: 0.98,
  Wilting: 0.9,
  Dormant: 0.8,
  New: 0.86,
};
/** Leaves fanned at each grown branch tip. Same shape on every tree; count follows health. */
const FAN: Record<Health["status"], number> = {
  Thriving: 6,
  Healthy: 5,
  Quiet: 3,
  Wilting: 2,
  Dormant: 1,
  New: 2,
};

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

function fanAt(x: number, y: number, count: number, seed: number) {
  return Array.from({ length: count }, (_, k) => {
    const spread = count === 1 ? -18 : -70 + (k * 140) / (count - 1);
    const ang = spread + ((seed * 13 + k * 7) % 8) - 4;
    const dist = 26 + (k % 3) * 11;
    const rad = (ang * Math.PI) / 180;
    return { x: x + Math.cos(rad) * dist, y: y + Math.sin(rad) * dist * 0.7, rot: ang };
  });
}

interface Props {
  logs: ActivityLog[]; // oldest first
  stage: Stage;
  health: Health;
  mini?: boolean;
  /** Health word, used to tint a quiet, wilting, or dormant tree. */
  tone?: string;
  /** Stagger the grow-in, in milliseconds. Plays on mount. */
  bloomDelay?: number;
  /** Hangout icons on the branches. The grove leaves these off. */
  showFruit?: boolean;
  grow?: number | null;
  highlight?: number | null;
  onFruit?: (i: number) => void;
}

export function Tree({ logs, stage, health, mini, tone, bloomDelay = 0, showFruit = true, grow, highlight, onFruit }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const n = Math.min(logs.length, SLOTS.length);
  const scale = growthScale(n) * health.shrink * REACH[health.status];
  const girth = GIRTH[health.status];
  const leaves = leafSpots(health.leaves, n);
  const fans = SLOTS.slice(0, n).flatMap((s, i) => fanAt(s.n[0], s.n[1], FAN[health.status], i).map((leaf, k) => ({ ...leaf, key: `${i}-${k}`, delay: 760 + i * 36 + k * 24 })));
  const toneClass = `${tone ? ` tone-${tone.toLowerCase()}` : ""} bloom`;
  const wait = (ms: number) => ({ animationDelay: `${bloomDelay + ms}ms` });

  if (stage === "Acorn" && n === 0) {
    return (
      <svg className={`tree acorn${toneClass}`} style={{ ["--bloom" as string]: `${bloomDelay}ms` }} viewBox="0 0 800 620" role="img" aria-label="An acorn, waiting to sprout">
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
      <svg className={`tree${mini ? " mini" : ""}${toneClass}`} style={{ ["--bloom" as string]: `${bloomDelay}ms` }} viewBox="0 0 800 620" xmlns="http://www.w3.org/2000/svg">
        <ellipse className="shade" cx="400" cy="608" rx="230" ry="16" />
        <ellipse className="ground" cx="400" cy="606" rx="170" ry="9" />
        <g className="grass">
          {[300, 345, 455, 500].map((x, i) => (
            <path key={x} d={`M${x} 608 Q${x + (i % 2 ? 6 : -6)} 586 ${x + (i % 2 ? 14 : -14)} 574`} style={wait(160 + i * 50)} />
          ))}
        </g>
        <g style={{ transform: `scale(${scale})`, transformOrigin: "400px 604px" }}>
          <g className="sway">
          <g className="branches">
            {SLOTS.slice(0, n).map((s, i) => {
              const side = i % 2 ? -1 : 1;
              return (
                <g key={i}>
                  <path d={s.d} strokeWidth={s.w} pathLength={1} className={grow === i ? "grow" : ""} style={wait(420 + i * 48)} />
                  <path d={`M${s.n[0]} ${s.n[1]} q ${side * 16} -14 ${side * 30} -4`} strokeWidth={Math.max(2.2, s.w * 0.4)} pathLength={1} style={wait(500 + i * 48)} />
                  <path d={`M${s.n[0]} ${s.n[1]} q ${-side * 12} -8 ${-side * 20} 8`} strokeWidth={Math.max(1.6, s.w * 0.28)} pathLength={1} style={wait(530 + i * 48)} />
                </g>
              );
            })}
          </g>
          <g className="trunk-girth" transform={`translate(400 604) scale(${girth} 1) translate(-400 -604)`}>
            <g className="roots">
              <path d="M386 598 C370 602 350 605 322 608" />
              <path d="M414 598 C430 602 450 605 478 608" />
              <path d="M398 602 C394 607 388 611 378 614" />
            </g>
            <path
              className="trunk"
              d="M370 604 C382 508 378 414 386 324 C390 244 388 164 392 92 L408 92 C412 164 410 244 414 324 C422 414 418 508 430 604 Z"
            />
            <path className="bark" d="M396 150 C399 280 396 430 394 575" />
            <path className="groove" d="M386 210 C384 330 382 450 380 560" />
            <path className="groove" d="M414 190 C416 320 418 460 420 560" />
          </g>
          <g className="leaves">
            {fans.map((l) => (
              <g key={l.key} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${LEAF_SIZE})`}>
                <g className="leaf-bit" style={wait(l.delay)}>
                  <path className="leaf" d="M0 0 C14 -9 32 -7 42 0 C32 7 14 9 0 0 Z" />
                  <path className="vein" d="M3 0 H30" />
                  <path className="vein side" d="M14 0 C16 -5 20 -6 24 -4" />
                  <path className="vein side" d="M14 0 C16 5 20 6 24 4" />
                </g>
              </g>
            ))}
            {leaves.map((l, k) => (
              <g key={`s${k}`} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${LEAF_SIZE})`}>
                <g className="leaf-bit" style={wait(820 + k * 28)}>
                  <path className="leaf" d={k % 3 === 0 ? "M0 0 C16 -10 36 -8 46 0 C36 8 16 10 0 0 Z" : "M0 0 C12 -7 26 -5 34 0 C26 5 12 7 0 0 Z"} />
                  <path className="vein" d={k % 3 === 0 ? "M3 0 H32" : "M3 0 H24"} />
                </g>
              </g>
            ))}
          </g>
          {showFruit && <g className="fruits">
            {SLOTS.slice(0, n).map((s, i) => {
              const log = logs[i];
              const cls = ["fruit", grow === i ? "pop" : "", i === n - 1 ? "latest" : "", highlight === i ? "hl" : ""].join(" ");
              return (
                <g key={log.id} data-log={log.id} transform={`translate(${s.n[0]} ${s.n[1]}) scale(${FRUIT_SIZE})`}>
                  <g
                    className={cls}
                    style={wait(980 + i * 70)}
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
                    <ellipse className="fruit-leaf" cx="12" cy="-14" rx="8" ry="3.4" transform="rotate(-28 12 -14)" />
                    <circle className="halo" r="30" />
                    <circle className="fruit-bg" r="23" />
                    <text className="fruit-emoji" y="1">
                      {log.emoji || catInfo(log.cat).emoji}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>}
          </g>
        </g>
      </svg>
      {!mini && (
        <div className={`tip${tipLog ? " show" : ""}`} style={tip ? { left: tip.x, top: tip.y } : undefined}>
          {tipLog && (
            <>
              <b>{tipLog.title}</b>
              <span>
                {fmtD(tipLog.date, { month: "short", day: "numeric" })} · {catInfo(tipLog.cat).label} · +{tipLog.points.total}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
