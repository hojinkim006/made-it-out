import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityLog } from "../lib/types";
import { catInfo, type Health, type Stage } from "../lib/scoring";
import { usePlaceData } from "../lib/places";
import { makeLocator, pinsFor } from "../lib/geo";
import { Tree } from "./Tree";
import { Icon } from "./Icons";
import { ErrorBoundary } from "./ErrorBoundary";
import { LeafFlight, PIN, reducedMotion, spotOf, type Flyer, type Spot } from "./LeafFlight";

const loadMap = () => import("./LeafMap");
const LeafMap = lazy(loadMap);
/** Fetch the map code while the pointer is on its way to the button, so the flight starts sooner. */
const preloadMap = () => void loadMap();

/** Give up waiting for the map to load and just show it. */
const READY_TIMEOUT = 4000;

interface Props {
  logs: ActivityLog[]; // the group's logs, oldest first
  meId: string | undefined;
  stage: Stage;
  health: Health;
  /** Indexes into `logs`. */
  grow?: number | null;
  highlight?: number | null;
  onOpen: (i: number) => void;
}

type View = "tree" | "map";

/**
 * Your tree (a leaf for each hangout you went to), the group's whole tree faded
 * behind it, and a map of where those leaves were picked. Switching views flies
 * each leaf between its branch and its pin.
 */
export function TreeStage({ logs, meId, stage, health, grow, highlight, onOpen }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<View>("tree");
  /** The map stays mounted after the first visit, so the flight back has pins to leave from. */
  const [mapOpened, setMapOpened] = useState(false);
  const [flight, setFlight] = useState<{ dir: View; flyers: Flyer[] } | null>(null);
  /** Set from the click until the leaves land; the toggles wait meanwhile. */
  const [landing, setLanding] = useState(false);
  const stageEl = useRef<HTMLDivElement>(null);
  const pending = useRef<{ dir: View; from: Map<string, Spot> } | null>(null);
  const mapReady = useRef(false);

  const mine = useMemo(() => logs.filter((l) => !!meId && l.attendeeIds.includes(meId)), [logs, meId]);
  const data = usePlaceData();
  const loc = useMemo(() => (data ? makeLocator(data) : null), [data]);
  const placed = useMemo(() => (loc ? pinsFor(logs, loc, meId) : null), [logs, loc, meId]);

  // Tree indexes are positions in `mine`; the page speaks in positions in `logs`.
  const toMine = (i: number | null | undefined) => (i == null ? i : mine.findIndex((l) => l.id === logs[i]?.id));
  const fromId = (id: string) => onOpen(logs.findIndex((l) => l.id === id));
  const missed = logs.length - mine.length;
  const unplaced = placed?.unplaced.filter((l) => showAll || mine.includes(l)) ?? [];

  /** Who flies: everything on the map right now. */
  const travellers = useCallback(() => (placed?.pins ?? []).filter((p) => p.mine || showAll).map((p) => p.log), [placed, showAll]);

  const fruitSpot = useCallback((id: string) => {
    const root = stageEl.current;
    if (!root) return null;
    const sel = `[data-log="${CSS.escape(id)}"] .fruit-bg`;
    // Your own tree first; a hangout you missed only grows on the faded group tree.
    return spotOf(root.querySelector(`.tree-layer > .tree-wrap ${sel}`)) ?? spotOf(root.querySelector(`.tree-ghost ${sel}`));
  }, []);
  const pinSpot = useCallback((id: string) => spotOf(stageEl.current?.querySelector(`.map-leaf[data-log="${CSS.escape(id)}"]`) ?? null, PIN), []);

  const finish = useCallback(() => {
    pending.current = null;
    setFlight(null);
    setLanding(false);
  }, []);

  /** Second half of a switch: the destination is laid out, so measure it and launch. */
  const launch = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const flyers: Flyer[] = [];
    for (const log of travellers()) {
      const from = p.from.get(log.id);
      const to = p.dir === "map" ? pinSpot(log.id) : fruitSpot(log.id);
      if (from && to) flyers.push({ id: log.id, emoji: log.emoji || catInfo(log.cat).emoji, mine: mine.includes(log), from, to });
    }
    if (flyers.length) setFlight({ dir: p.dir, flyers });
    else finish();
  }, [travellers, pinSpot, fruitSpot, mine, finish]);

  const onMapReady = useCallback(() => {
    mapReady.current = true;
    if (pending.current?.dir === "map") launch();
  }, [launch]);

  // Don't strand the tree hidden if the map never reports in.
  useEffect(() => {
    if (!landing || flight) return;
    const t = setTimeout(finish, READY_TIMEOUT);
    return () => clearTimeout(t);
  }, [landing, flight, finish]);

  const toggleMap = () => {
    const next: View = view === "map" ? "tree" : "map";
    if (next === "map") setMapOpened(true);
    if (!reducedMotion() && placed) {
      // First half: note where every leaf starts before anything moves.
      const from = new Map<string, Spot>();
      for (const log of travellers()) {
        const s = next === "map" ? fruitSpot(log.id) : pinSpot(log.id);
        if (s) from.set(log.id, s);
      }
      if (from.size) {
        pending.current = { dir: next, from };
        setLanding(true);
        // The tree is always mounted; the map may still be loading, so it calls back when ready.
        if (next === "tree" || mapReady.current) requestAnimationFrame(launch);
      }
    }
    setView(next);
  };

  const isMap = view === "map";
  return (
    <>
      <div className="tree-toggles" role="group" aria-label="Tree view">
        <button type="button" className={`chip${showAll ? " on" : ""}`} aria-pressed={showAll} disabled={landing} onClick={() => setShowAll((v) => !v)}>
          <Icon name="leaf" size={14} /> Group total · {logs.length}
        </button>
        <button type="button" className={`chip${isMap ? " on" : ""}`} aria-pressed={isMap} disabled={landing} onClick={toggleMap} onPointerEnter={preloadMap} onFocus={preloadMap}>
          <Icon name="pin" size={14} /> Map
        </button>
        <span className="muted small">
          You went to {mine.length} of {logs.length}
          {showAll && missed > 0 ? ` · the faded ${isMap ? "leaves" : "tree"} show the ${missed} you missed` : ""}
        </span>
      </div>
      <div ref={stageEl} className={`tree-stage${isMap ? " is-map" : ""}${flight ? " landing" : ""}`}>
        <div className="tree-layer" aria-hidden={isMap} inert={isMap}>
          {showAll && (
            <div className="tree-ghost" aria-hidden>
              <Tree logs={logs} stage={stage} health={health} mini tone={health.status} />
            </div>
          )}
          <Tree logs={mine} stage={stage} health={health} tone={health.status} grow={toMine(grow)} highlight={toMine(highlight)} onFruit={(i) => fromId(mine[i].id)} />
        </div>
        {mapOpened && (
          <div className="map-layer" aria-hidden={!isMap} inert={!isMap}>
            <ErrorBoundary fallback={<p className="map-msg">The map couldn't load. Your tree is still here; switch the map off to see it.</p>}>
              <Suspense fallback={<p className="map-msg">Loading map…</p>}>
                {placed ? <LeafMap pins={placed.pins} showAll={showAll} onOpen={fromId} onReady={onMapReady} /> : <p className="map-msg">Loading places…</p>}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>
      {isMap && unplaced.length > 0 && (
        <p className="muted small map-unplaced">
          Not on the map (no known location): {unplaced.map((l) => l.title).join(", ")}
        </p>
      )}
      {flight && <LeafFlight flyers={flight.flyers} dir={flight.dir} onDone={finish} />}
    </>
  );
}
