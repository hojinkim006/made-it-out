import { useState } from "react";
import { rarityPercentile, searchSpots, type PlaceData, type Spot } from "../lib/places";
import { todayISO } from "../lib/dates";

/** Location field that searches real Boston places and events, or takes free text. */
export function PlaceSearch({
  data,
  value,
  picked,
  onText,
  onPick,
  placeholder,
}: {
  data: PlaceData | null;
  value: string;
  picked: Spot | null;
  onText: (v: string) => void;
  onPick: (s: Spot) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = data && open && !picked ? searchSpots(data, value, todayISO()) : [];

  const choose = (s: Spot) => {
    onPick(s);
    setOpen(false);
  };

  return (
    <div className="place-search">
      <input
        className="field"
        value={value}
        placeholder={placeholder ?? (data ? "Search Boston places and events, or type anything" : "Location")}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[active]);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
      />
      {results.length > 0 && (
        <div className="place-results" role="listbox">
          {results.map((s, i) => (
            <button
              key={s.id}
              role="option"
              aria-selected={i === active}
              className={`place-row${i === active ? " on" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
            >
              <span className="place-emoji">{s.emoji}</span>
              <span className="t">
                <b>{s.name}</b>
                <span className="muted">
                  {s.kindLabel} · {s.hood}
                  {s.date ? ` · ${s.date}` : ""}
                </span>
              </span>
              <RarityTag rarity={s.rarity} data={data!} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RarityTag({ rarity, data }: { rarity: number; data: PlaceData }) {
  const pct = rarityPercentile(data, rarity);
  const cls = pct >= 90 ? "" : " soft";
  return (
    <span className={`badge${cls}`} title={`Rarity ${rarity.toFixed(2)}: rarer than ${pct}% of Boston spots`}>
      {pct >= 50 ? `Top ${Math.max(1, 100 - pct)}% rare` : "Classic"}
    </span>
  );
}
