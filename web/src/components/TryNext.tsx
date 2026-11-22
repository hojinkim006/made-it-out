import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useNav } from "../nav";
import { Seg } from "./Sheet";
import { Icon } from "./Icons";
import { RarityTag } from "./PlaceSearch";
import { CATS, normLabel } from "../lib/scoring";
import { fmtD, todayISO } from "../lib/dates";
import { suggestPlaces, upcomingEvents, usePlaceData, type Spot } from "../lib/places";
import type { Cat, Group } from "../lib/types";

/**
 * "Try something new": rare Boston spots this group hasn't logged yet, and
 * upcoming one-off city events. Picking one prefills a plan.
 */
export function TryNext({ g, onPick }: { g: Group; onPick?: (s: Spot) => void }) {
  const { state } = useStore();
  const { go } = useNav();
  const data = usePlaceData();
  const [tab, setTab] = useState<"spots" | "events">("spots");
  const [cat, setCat] = useState<Cat | undefined>();
  const [shuffle, setShuffle] = useState(0);

  const done = useMemo(() => {
    const s = new Set<string>();
    for (const l of state.logs)
      if (l.groupId === g.id) {
        if (l.placeId) s.add(l.placeId);
        l.labels.forEach((x) => s.add(normLabel(x)));
      }
    return s;
  }, [state.logs, g.id]);

  if (!data) return null;
  const today = todayISO();
  const items = tab === "spots" ? suggestPlaces(data, done, { cat, limit: 5, offset: shuffle * 5 }) : upcomingEvents(data, today, 5, cat);

  const choose = (s: Spot) => {
    if (onPick) return onPick(s);
    go("plan", {
      groupId: g.id,
      prefill: { title: s.date ? s.name : `${s.kindLabel} at ${s.name}`, where: `${s.name} · ${s.hood}`, placeId: s.id, date: s.date },
    });
  };

  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Try something new</h2>
          <p className="muted">Rarer spots score more. Picked from real Boston data.</p>
        </div>
        {tab === "spots" && (
          <button className="link" onClick={() => setShuffle((x) => x + 1)}>
            More ideas <Icon name="arrow" />
          </button>
        )}
      </div>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { key: "spots", label: "Rare spots" },
          { key: "events", label: "Happening soon" },
        ]}
      />
      <div className="try-filters">
        <button className={`chip${!cat ? " on" : ""}`} onClick={() => setCat(undefined)}>
          All
        </button>
        {(Object.keys(CATS) as Cat[]).map((k) => (
          <button key={k} className={`chip${cat === k ? " on" : ""}`} onClick={() => (setCat(cat === k ? undefined : k), setShuffle(0))}>
            {CATS[k].label}
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="muted small" style={{ padding: "10px 0" }}>Nothing here right now. Try another filter.</p>}
      {items.map((s) => (
        <div className="try-row" key={s.id}>
          <span className="place-emoji">{s.emoji}</span>
          <span className="t">
            <b>{s.name}</b>
            <span className="muted">
              {s.date ? `${fmtD(s.date, { weekday: "short", month: "short", day: "numeric" })} · ` : ""}
              {s.kindLabel} · {s.hood}
            </span>
            <RarityTag rarity={s.rarity} data={data} />
          </span>
          <button className="btn btn-soft sm" onClick={() => choose(s)}>
            {onPick ? "Use" : "Plan it"}
          </button>
        </div>
      ))}
      <p className="attrib">Places © OpenStreetMap contributors · rarity uses Yelp Open Dataset category counts · events: City of Boston.</p>
    </section>
  );
}
