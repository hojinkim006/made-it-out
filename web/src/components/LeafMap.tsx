import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "../lib/geo";
import { catInfo } from "../lib/scoring";
import { fmtD } from "../lib/dates";

const BOSTON: L.LatLngTuple = [42.3554, -71.0656];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function icon(p: Pin, showAll: boolean) {
  const faded = !p.mine;
  return L.divIcon({
    className: "",
    html: `<span data-log="${esc(p.log.id)}" class="map-leaf${faded ? " faded" : ""}${!p.exact ? " approx" : ""}" style="${faded && !showAll ? "display:none" : ""}"><i>${esc(p.log.emoji || catInfo(p.log.cat).emoji)}</i></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -28],
  });
}

interface Props {
  pins: Pin[];
  /** Also show events the viewer missed, faded. */
  showAll: boolean;
  onOpen: (logId: string) => void;
  /** Called each time the pins are placed and the view has settled. */
  onReady?: () => void;
}

/** Event leaves on a map of Boston. Uses Leaflet directly; loaded lazily from the group page. */
export default function LeafMap({ pins, showAll, onOpen, onReady }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const open = useRef(onOpen);
  const ready = useRef(onReady);
  useEffect(() => {
    open.current = onOpen;
    ready.current = onReady;
  }, [onOpen, onReady]);

  useEffect(() => {
    if (!el.current) return;
    // On touch screens a one-finger swipe should scroll the page, not trap it in the map.
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView(BOSTON, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The card fades in, so Leaflet measures a zero-size box on mount. Re-measure once visible.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const shown = pins.filter((p) => p.mine || showAll);
    for (const p of pins) {
      const where = p.log.where.split("·")[0].trim();
      L.marker([p.lat, p.lon], { icon: icon(p, showAll), keyboard: p.mine || showAll, zIndexOffset: p.mine ? 1000 : 0 })
        .bindPopup(
          `<b>${esc(p.log.title)}</b><br>${esc(fmtD(p.log.date, { month: "short", day: "numeric" }))} · ${esc(where || "—")}${p.exact ? "" : " (area)"}<br>${p.mine ? "You went" : "You missed this one"}<br><button type="button" class="map-open">Open</button>`,
        )
        .on("popupopen", (e) => {
          e.popup
            .getElement()
            ?.querySelector(".map-open")
            ?.addEventListener("click", () => open.current(p.log.id));
        })
        .addTo(g);
    }
    // No pan/zoom animation: the tree-to-map flight needs pins at their final spots right away.
    if (shown.length) m.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lon] as L.LatLngTuple)).pad(0.25), { maxZoom: 14, animate: false });
    else m.setView(BOSTON, 12, { animate: false });
    const raf = requestAnimationFrame(() => ready.current?.());
    return () => cancelAnimationFrame(raf);
  }, [pins, showAll]);

  return <div ref={el} className="leaf-map" role="region" aria-label="Map of hangouts" />;
}
