import type { Cat } from "../lib/types";

const paths = {
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevL: <path d="M15 18l-6-6 6-6" />,
  chevR: <path d="M9 18l6-6-6-6" />,
  chevD: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  person: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2.5 20a7.5 7.5 0 0 1 15 0M19 8v6M16 11h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  out: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-8 9" />
    </>
  ),
  vote: <path d="M4 12l5 5L20 6M4 20h16" />,
  leaf: <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg className="i" viewBox="0 0 24 24" style={size ? { width: size, height: size } : undefined} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function CatIcon({ cat }: { cat: Cat }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <use href={`#c-${cat}`} />
    </svg>
  );
}

/** Shared SVG symbols and filters, copied from the original design. Render once. */
export function SvgDefs() {
  const g = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="fshadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity=".13" />
        </filter>
        <symbol id="c-water" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M2.5 11.5h19c-1 2.4-3.2 3.5-5.5 3.5H8c-2.3 0-4.5-1.1-5.5-3.5z" />
            <path d="M15.5 4l-4 11" />
            <path d="M3 19.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
          </g>
        </symbol>
        <symbol id="c-art" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-1.3-1.1-1.5-1.1-2.6 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.3-9-7.3z" />
            <circle cx="7.5" cy="11" r="1" />
            <circle cx="10" cy="7" r="1" />
            <circle cx="15" cy="7.5" r="1" />
          </g>
        </symbol>
        <symbol id="c-food" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 21V3c-2 1-3.5 3.5-3.5 7.5H17" />
          </g>
        </symbol>
        <symbol id="c-music" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M9 17V5.5L19 3.5V15" />
            <circle cx="6.5" cy="17" r="2.5" />
            <circle cx="16.5" cy="15" r="2.5" />
          </g>
        </symbol>
        <symbol id="c-outdoors" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M2.5 19.5l7-11 4 6 2.5-3.5 5.5 8.5z" />
            <circle cx="17" cy="5.5" r="1.8" />
          </g>
        </symbol>
        <symbol id="c-coffee" viewBox="0 0 24 24">
          <g {...g}>
            <path d="M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5z" />
            <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
            <path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5" />
          </g>
        </symbol>
        <symbol id="c-games" viewBox="0 0 24 24">
          <g {...g}>
            <rect x="2.5" y="7.5" width="19" height="10" rx="5" />
            <path d="M7.5 10.5v4M5.5 12.5h4" />
            <circle cx="15.5" cy="11.5" r=".6" />
            <circle cx="17.5" cy="13.5" r=".6" />
          </g>
        </symbol>
        <symbol id="c-sports" viewBox="0 0 24 24">
          <g {...g}>
            <circle cx="12" cy="12" r="9" />
            <path d="M4 8.5c3.5 1.5 7 .5 9.5-2.5M10.5 20.8c.3-3.5 3-6.3 6.5-6.8 1.4-.2 2.8 0 4 .5" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}

export function Avatar({ name, me }: { name: string; me?: boolean }) {
  return (
    <span className={`av${me ? " me" : ""}`} title={name}>
      {name[0]?.toUpperCase()}
    </span>
  );
}
