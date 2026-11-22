import { Icon } from "./Icons";
import { Tree } from "./Tree";
import type { ActivityLog, Group } from "../lib/types";
import type { Health, Stage } from "../lib/scoring";

const FACES: Record<string, string> = {
  hojin: "#6aa8c8",
  david: "#e2a84a",
  andrew: "#2a2a2e",
  matt: "#8d6a4a",
  john: "#d07a88",
  priya: "#6a8f6a",
  sam: "#7a8cb0",
  elena: "#b07a9a",
};

export interface GroveTree {
  group: Group;
  stage: Stage;
  health: Health;
  logs: ActivityLog[];
  friends: { id: string; name: string }[];
}

export function Grove({
  trees,
  onOpen,
  onPlant,
}: {
  trees: GroveTree[];
  onOpen: (id: string) => void;
  onPlant: () => void;
}) {
  return (
    <section className="garden" aria-label="Your trees">
      <Ground />
      <div className="grove-row">
        {trees.map((t, i) => (
          <button
            key={t.group.id}
            className="grove-item"
            onClick={() => onOpen(t.group.id)}
            aria-label={`${t.group.name}, with ${t.friends.map((f) => f.name).join(", ") || "you"}`}
          >
            <span className="grove-tree-body" style={{ ["--dur" as string]: `${3.4 + (i % 4) * 0.35}s`, ["--lag" as string]: `${-i * 0.45}s` }}>
              <Tree logs={t.logs} stage={t.stage} health={t.health} tone={t.health.status} mini showFruit={false} bloomDelay={i * 140} />
            </span>
            <Tag names={t.friends} label={t.group.name} />
          </button>
        ))}
        <button className="grove-item plant" onClick={onPlant} aria-label="Plant a group">
          <Mound />
          <Tag names={[]} label="Plant a group" plant />
        </button>
      </div>
    </section>
  );
}

function Tag({ names, label, plant }: { names: { id: string; name: string }[]; label: string; plant?: boolean }) {
  const faces = names.slice(0, 3);
  const extra = Math.max(0, names.length - 3);
  const n = plant ? 0 : faces.length + (extra > 0 ? 1 : 0);
  return (
    <span className="imtag">
      {plant ? (
        <span className="imfaces n1">
          <span className="face sprout" aria-hidden="true">
            <Icon name="plus" size={18} />
          </span>
        </span>
      ) : (
        n > 0 && (
          <span className={`imfaces n${Math.min(4, n)}`}>
            {faces.map((f) => (
              <span key={f.id} className="face" style={{ background: FACES[f.id] ?? "#8e8e93" }} title={f.name}>
                {f.name[0]?.toUpperCase()}
              </span>
            ))}
            {extra > 0 && (
              <span className="face more" title={`${extra} more`}>
                +{extra}
              </span>
            )}
          </span>
        )
      )}
      <span className="impill">
        <span>{label}</span>
        <Icon name="chevR" size={16} />
      </span>
    </span>
  );
}

function Ground() {
  return (
    <svg className="grove-ground" viewBox="0 0 1200 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id="grove-blades" width="54" height="40" patternUnits="userSpaceOnUse">
          <path d="M8 40 C9 28 5 18 4 10" stroke="#4c8a36" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M22 40 C20 26 26 16 23 8" stroke="#2d6830" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M36 40 C38 30 33 20 38 12" stroke="#74b456" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M14 40 C15 32 11 24 12 16" stroke="#3d7632" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect x="0" y="28" width="1200" height="92" fill="url(#grove-blades)" opacity=".55" />
      <path d="M0 78 Q200 68 400 76 T800 72 T1200 78 V120 H0 Z" fill="#5f9844" opacity=".22" />
      <path d="M0 96 Q280 88 560 96 T1200 92 V120 H0 Z" fill="#2f642c" opacity=".18" />
      {[70, 210, 360, 520, 680, 840, 1000, 1140].map((x, i) => (
        <g key={x} transform={`translate(${x} 112)`}>
          <path d={`M0 0 C${i % 2 ? -4 : 3} -22 ${i % 2 ? -8 : 6} -36`} stroke={i % 3 ? "#3c7832" : "#68aa4c"} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M0 0 C${i % 2 ? 6 : -4} -16 ${i % 2 ? 10 : -8} -28`} stroke="#2c6228" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

function Mound() {
  return (
    <svg className="mound-art" viewBox="0 0 180 120" aria-hidden="true">
      <defs>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4a06a" />
          <stop offset="45%" stopColor="#8d6236" />
          <stop offset="100%" stopColor="#5c3a22" />
        </linearGradient>
        <radialGradient id="moss" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8fd16a" />
          <stop offset="100%" stopColor="#2f7a34" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="96" rx="70" ry="16" fill="#3d6a32" opacity=".35" />
      <path d="M22 90c8-36 36-52 68-52s62 18 70 52c-16 14-42 20-70 20S40 104 22 90z" fill="url(#soil)" />
      <path d="M48 78c10-8 22-10 34-4 8 4 6 10-2 12-14 2-24-2-32-8z" fill="url(#moss)" opacity=".9" />
      <path d="M96 84c16-2 28 4 34 12-10 4-22 2-34-4-6-4-8-8 0-8z" fill="#3e8a40" opacity=".8" />
      <ellipse cx="46" cy="92" rx="7" ry="4.5" fill="#6d5848" />
      <ellipse cx="132" cy="94" rx="6" ry="4" fill="#7a6754" />
      <ellipse cx="118" cy="86" rx="4" ry="2.6" fill="#a89880" />
      <path d="M88 70c0-16 2-28 6-36" stroke="#2f6a32" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M94 40c6-8 14-8 16-2-8 1-12 4-16 2z" fill="#7dce62" />
      <path d="M94 46c-8-6-14-4-14 2 6 1 10 1 14-2z" fill="#3e9a44" />
      <circle cx="64" cy="74" r="1.2" fill="#e7d3a4" />
      <circle cx="108" cy="70" r="1" fill="#f0e2c0" />
      <circle cx="80" cy="88" r="1.1" fill="#5c3a22" />
    </svg>
  );
}
