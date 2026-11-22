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
/** A new set of branches opens every 3 hangouts. */
const MILESTONES = [3, 6, 9, 12, 15, 18, 21];
export const nextMilestone = (n: number) => MILESTONES.find((m) => m > n) ?? MAX_FRUIT;

/** Progress toward the next branch, counted in hangouts of 3. */
export function milestoneProgress(n: number) {
  const next = nextMilestone(n);
  const prev = [...MILESTONES].reverse().find((m) => m <= n) ?? 0;
  const span = Math.max(1, next - prev);
  return { next, prev, span, into: Math.min(span, Math.max(0, n - prev)), left: Math.max(0, next - n) };
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

/** How full the soft foliage behind the leaves is, by health. A dormant tree goes bare. */
const CANOPY: Record<Health["status"], number> = {
  Thriving: 1,
  Healthy: 0.9,
  Quiet: 0.72,
  Wilting: 0.5,
  Dormant: 0,
  New: 0.62,
};

/** Soft, overlapping foliage masses around each grown branch tip, so the crown reads as one tree. */
function canopyBlobs(branches: number, fullness: number) {
  if (fullness <= 0 || branches === 0) return [];
  const pts: { x: number; y: number; r: number; i: number }[] = [];
  SLOTS.slice(0, branches).forEach((s, i) => {
    const [x, y] = s.n;
    const [sx, sy] = s.d.slice(1).split(" ").slice(0, 2).map(Number);
    pts.push({ x, y, r: 40 + ((i * 7) % 3) * 6, i });
    pts.push({ x: x * 0.6 + sx * 0.4, y: y * 0.6 + sy * 0.4 - 10, r: 34, i });
  });
  // Fill the crown's middle around the trunk so the masses join up.
  const low = Math.max(...SLOTS.slice(0, branches).map((s) => s.n[1]));
  for (let y = 120; y < low - 20; y += 70) pts.push({ x: 400, y, r: 46, i: 0 });
  return pts.map((p) => ({ ...p, r: p.r * fullness }));
}

/** One tuft of tapered grass blades, rooted at (x, y). */
function tuft(x: number, y: number, h: number, seed: number) {
  const blades = [
    { dx: -5, bend: -9, h: h * 0.72 },
    { dx: 0, bend: 3 + (seed % 3), h },
    { dx: 5, bend: 10, h: h * 0.6 },
  ];
  return blades.map((b) => {
    const bx = x + b.dx;
    const w = 2.4;
    return `M${bx - w} ${y} Q${bx + b.bend * 0.25} ${y - b.h * 0.55} ${bx + b.bend} ${y - b.h} Q${bx + b.bend * 0.25 + w * 0.7} ${y - b.h * 0.5} ${bx + w} ${y} Z`;
  });
}

const TUFTS: [number, number, number][] = [
  [262, 606, 22],
  [318, 609, 30],
  [356, 611, 18],
  [446, 611, 20],
  [486, 609, 32],
  [540, 606, 22],
  [212, 604, 14],
  [590, 604, 15],
];

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
  onBud?: () => void;
}

export function Tree({ logs, stage, health, mini, tone, bloomDelay = 0, showFruit = true, grow, highlight, onFruit, onBud }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const n = Math.min(logs.length, SLOTS.length);
  const ms = nextMilestone(logs.length);
  const scale = STAGE_SCALE[stage] * health.shrink * REACH[health.status];
  const girth = GIRTH[health.status];
  const leaves = leafSpots(health.leaves, n);
  const fans = SLOTS.slice(0, n).flatMap((s, i) => fanAt(s.n[0], s.n[1], FAN[health.status], i).map((leaf, k) => ({ ...leaf, key: `${i}-${k}`, delay: 760 + i * 36 + k * 24 })));
  const blobs = canopyBlobs(n, CANOPY[health.status]);
  const toneClass = `${tone ? ` tone-${tone.toLowerCase()}` : ""} bloom`;
  const wait = (ms: number) => ({ animationDelay: `${bloomDelay + ms}ms` });

  if (stage === "Acorn" && n === 0) {
    return (
      <svg className={`tree acorn${toneClass}`} style={{ ["--bloom" as string]: `${bloomDelay}ms` }} viewBox="0 0 800 620" role="img" aria-label="An acorn, waiting to sprout">
        <ellipse className="shade" cx="400" cy="608" rx="200" ry="14" />
        <path className="ground" d="M236 610 C290 598 340 594 400 594 C460 594 510 598 564 610 C510 618 460 620 400 620 C340 620 290 618 236 610 Z" />
        <g className="grass">
          {TUFTS.slice(0, 6).map(([x, y, h], i) => (
            <g key={x} className={`tuft t${i % 3}`}>
              {tuft(x, y, h * 0.8, i).map((d, k) => (
                <path key={k} d={d} />
              ))}
            </g>
          ))}
        </g>
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
        <ellipse className="shade" cx="400" cy="610" rx="250" ry="18" />
        <path className="ground" d="M196 612 C250 596 330 592 400 592 C470 592 550 596 604 612 C540 620 470 622 400 622 C330 622 260 620 196 612 Z" />
        <ellipse className="ground-shadow" cx="404" cy="606" rx="70" ry="7" />
        <g className="grass">
          {TUFTS.map(([x, y, h], i) => (
            <g key={x} className={`tuft t${i % 3}`} style={wait(160 + i * 40)}>
              {tuft(x, y, h, i).map((d, k) => (
                <path key={k} d={d} />
              ))}
            </g>
          ))}
          <g className="flowers">
            <circle cx="292" cy="604" r="3.2" />
            <circle cx="516" cy="603" r="2.8" />
            <circle cx="232" cy="607" r="2.4" />
          </g>
        </g>
        <g style={{ transform: `scale(${scale})`, transformOrigin: "400px 604px" }}>
          <g className="sway">
          <g className="canopy">
            <g className="deep">
              {blobs.map((b, k) => (
                <circle key={k} className="blob" cx={b.x + 8} cy={b.y + 12} r={b.r * 1.08} style={wait(700 + b.i * 40)} />
              ))}
            </g>
            <g className="mid">
              {blobs.map((b, k) => (
                <circle key={k} className="blob" cx={b.x} cy={b.y} r={b.r} style={wait(720 + b.i * 40)} />
              ))}
            </g>
            <g className="light">
              {blobs.map((b, k) => (
                <circle key={k} className="blob" cx={b.x - 10} cy={b.y - 14} r={b.r * 0.55} style={wait(760 + b.i * 40)} />
              ))}
            </g>
          </g>
          <g className="future">
            {SLOTS.slice(n, ms).map((s, i) => (
              <path key={i} d={s.d} />
            ))}
          </g>
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
              <path d="M372 600 C356 604 336 607 314 609" />
              <path d="M428 600 C444 604 466 607 488 609" />
              <path d="M396 604 C392 609 386 612 374 615" />
            </g>
            <path
              className="trunk"
              d="M354 607 C370 600 377 584 379 552 C383 472 381 402 387 324 C391 244 389 164 393 92 L407 92 C411 164 409 244 413 324 C419 402 417 472 421 552 C423 584 430 600 446 607 Z"
            />
            <path
              className="trunk-shade"
              d="M403 92 L407 92 C411 164 409 244 413 324 C419 402 417 472 421 552 C423 584 430 600 446 607 L405 607 C409 520 406 420 405 324 C404 240 404 160 403 92 Z"
            />
            <path className="bark" d="M390 170 C389 280 386 420 384 540" />
            <path className="groove" d="M398 236 q-3 14 1 26" />
            <path className="groove" d="M408 380 q3 16 -1 30" />
            <path className="groove" d="M392 468 q-4 18 0 34" />
          </g>
          <g className="leaves">
            {fans.map((l, k) => (
              <g key={l.key} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${0.82 + ((k * 7) % 5) * 0.08})`}>
                <g className="leaf-bit" style={wait(l.delay)}>
                  <path className={`leaf v${k % 3}`} d="M0 0 C14 -9 32 -7 42 0 C32 7 14 9 0 0 Z" />
                  <path className="vein" d="M3 0 H30" />
                  <path className="vein side" d="M14 0 C16 -5 20 -6 24 -4" />
                  <path className="vein side" d="M14 0 C16 5 20 6 24 4" />
                </g>
              </g>
            ))}
            {leaves.map((l, k) => (
              <g key={`s${k}`} transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}>
                <g className="leaf-bit" style={wait(820 + k * 28)}>
                  <path className={`leaf v${(k + 1) % 3}`} d={k % 3 === 0 ? "M0 0 C16 -10 36 -8 46 0 C36 8 16 10 0 0 Z" : "M0 0 C12 -7 26 -5 34 0 C26 5 12 7 0 0 Z"} />
                  <path className="vein" d={k % 3 === 0 ? "M3 0 H32" : "M3 0 H24"} />
                </g>
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
          {showFruit && <g className="fruits">
            {SLOTS.slice(0, n).map((s, i) => {
              const log = logs[i];
              const cls = ["fruit", grow === i ? "pop" : "", i === n - 1 ? "latest" : "", highlight === i ? "hl" : ""].join(" ");
              return (
                <g key={log.id} transform={`translate(${s.n[0]} ${s.n[1]})`}>
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
                    <circle className="fruit-shadow" cy="2.5" r="24" />
                    <circle className="fruit-bg" r="23" />
                    <text className="fruit-emoji" y="1">
                      {log.emoji || CATS[log.cat].emoji}
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
                {fmtD(tipLog.date, { month: "short", day: "numeric" })} · {CATS[tipLog.cat].label} · +{tipLog.points.total}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
