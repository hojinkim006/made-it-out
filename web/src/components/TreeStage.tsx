import { lazy, Suspense, useMemo, useState } from "react";
import type { ActivityLog } from "../lib/types";
import type { Health, Stage } from "../lib/scoring";
import { usePlaceData } from "../lib/places";
import { makeLocator, pinsFor } from "../lib/geo";
import { Tree } from "./Tree";
import { Icon } from "./Icons";
import { ErrorBoundary } from "./ErrorBoundary";

const LeafMap = lazy(() => import("./LeafMap"));

interface Props {
  logs: ActivityLog[]; // the group's logs, oldest first
  meId: string | undefined;
  stage: Stage;
  health: Health;
  /** Indexes into `logs`. */
  grow?: number | null;
  highlight?: number | null;
  onOpen: (i: number) => void;
  onBud: () => void;
}

/**
 * Your tree (a leaf for each hangout you went to), the group's whole tree faded
 * behind it, and a map of where those leaves were picked.
 */
export function TreeStage({ logs, meId, stage, health, grow, highlight, onOpen, onBud }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"tree" | "map">("tree");
  const mine = useMemo(() => logs.filter((l) => !!meId && l.attendeeIds.includes(meId)), [logs, meId]);
  const data = usePlaceData();
  const loc = useMemo(() => (data ? makeLocator(data) : null), [data]);
  const placed = useMemo(() => (loc ? pinsFor(logs, loc, meId) : null), [logs, loc, meId]);

  // Tree indexes are positions in `mine`; the page speaks in positions in `logs`.
  const toMine = (i: number | null | undefined) => (i == null ? i : mine.findIndex((l) => l.id === logs[i]?.id));
  const fromId = (id: string) => onOpen(logs.findIndex((l) => l.id === id));
  const missed = logs.length - mine.length;
  const unplaced = placed?.unplaced.filter((l) => showAll || mine.includes(l)) ?? [];

  return (
    <>
      <div className="tree-toggles" role="group" aria-label="Tree view">
        <button type="button" className={`chip${showAll ? " on" : ""}`} aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
          <Icon name="leaf" size={14} /> Group total · {logs.length}
        </button>
        <button type="button" className={`chip${view === "map" ? " on" : ""}`} aria-pressed={view === "map"} onClick={() => setView((v) => (v === "map" ? "tree" : "map"))}>
          <Icon name="pin" size={14} /> Map
        </button>
        <span className="muted small">
          You went to {mine.length} of {logs.length}
          {showAll && missed > 0 ? ` · the faded ${view === "map" ? "leaves" : "tree"} show the ${missed} you missed` : ""}
        </span>
      </div>
      <div className={`tree-stage${view === "map" ? " is-map" : ""}`}>
        <div className="tree-layer" aria-hidden={view === "map"}>
          {showAll && (
            <div className="tree-ghost" aria-hidden>
              <Tree logs={logs} stage={stage} health={health} mini tone={health.status} />
            </div>
          )}
          <Tree logs={mine} stage={stage} health={health} tone={health.status} grow={toMine(grow)} highlight={toMine(highlight)} onFruit={(i) => fromId(mine[i].id)} onBud={onBud} />
        </div>
        {view === "map" && (
          <div className="map-layer">
            <ErrorBoundary fallback={<p className="map-msg">The map couldn't load. Your tree is still here; switch the map off to see it.</p>}>
              <Suspense fallback={<p className="map-msg">Loading map…</p>}>
                {placed ? <LeafMap pins={placed.pins} showAll={showAll} onOpen={fromId} /> : <p className="map-msg">Loading places…</p>}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>
      {view === "map" && unplaced.length > 0 && (
        <p className="muted small map-unplaced">
          Not on the map (no known location): {unplaced.map((l) => l.title).join(", ")}
        </p>
      )}
    </>
  );
}
