import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icons";

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className={`overlay${shown ? " show" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <button className="x" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Segmented control with the sliding white indicator from the design. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  id,
}: {
  options: { key: T; label: ReactNode }[];
  value: T;
  onChange: (k: T) => void;
  id?: string;
}) {
  const [ind, setInd] = useState<{ w: number; x: number }>({ w: 0, x: 0 });
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLButtonElement>("button.active");
      if (a) setInd({ w: a.offsetWidth, x: a.offsetLeft });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [el, value]);
  return (
    <div className="seg" id={id} ref={setEl}>
      <span className="ind" style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} />
      {options.map((o) => (
        <button key={o.key} className={o.key === value ? "active" : ""} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
