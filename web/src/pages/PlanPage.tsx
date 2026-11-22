import { useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { Icon } from "../components/Icons";
import { fmtD, fmtT, nextFriday, parseD, iso, todayISO } from "../lib/dates";
import { postPlan } from "../lib/plans";
import { fmtRange } from "../lib/budget";
import { totalRange } from "../lib/insight";
import { usePlanInsight } from "../lib/useInsight";
import { PlaceSearch } from "../components/PlaceSearch";
import { TryNext } from "../components/TryNext";
import { spotById, usePlaceData, type Spot } from "../lib/places";

export function PlanPage() {
  const { me, myGroups, update, toast } = useStore();
  const { route, go } = useNav();
  const [gid, setGid] = useState(route.groupId ?? myGroups[0]?.id);
  const pre = route.prefill;
  const [title, setTitle] = useState(pre?.title ?? "");
  const [where, setWhere] = useState(pre?.where ?? "");
  const [placeId, setPlaceId] = useState(pre?.placeId);
  const [date, setDate] = useState(pre?.date && pre.date >= todayISO() ? pre.date : nextFriday());
  const data = usePlaceData();
  const spot = data ? spotById(data, placeId) : null;
  const [time, setTime] = useState("18:30");
  const [alt, setAlt] = useState(false);
  const [date2, setDate2] = useState(() => {
    const d = parseD(pre?.date && pre.date >= todayISO() ? pre.date : nextFriday());
    d.setDate(d.getDate() + 1);
    return iso(d);
  });
  const [time2, setTime2] = useState("18:30");
  const [auto, setAuto] = useState(false);
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [bad, setBad] = useState<string | null>(null);
  const [tagOff, setTagOff] = useState(false);
  const g = myGroups.find((x) => x.id === gid) ?? myGroups[0];
  const ins = usePlanInsight(title, where, g?.memberIds.length ?? 1);
  if (!g) return <p className="muted">Create a group first.</p>;
  const est = ins?.priced ? { lo: ins.lo, hi: ins.hi } : null;
  const tag = tagOff ? null : (ins?.tag ?? null);

  const pick = (s: Spot) => {
    setPlaceId(s.id);
    setWhere(`${s.name} · ${s.hood}`);
    if (!title.trim()) setTitle(s.date ? s.name : `${s.kindLabel} at ${s.name}`);
    if (s.date && s.date >= todayISO()) setDate(s.date);
  };

  const share = () => {
    if (!title.trim()) return setBad("title");
    if (!date) return setBad("date");
    const typed = price.trim() === "" ? null : Math.round(Number(price));
    if (typed !== null && (Number.isNaN(typed) || typed < 0)) return setBad("price");
    const options = [{ id: uid(), date, time: time || "18:00" }];
    if (alt && date2 && !(date2 === date && (time2 || "18:00") === (time || "18:00"))) options.push({ id: uid(), date: date2, time: time2 || "18:00" });
    update((s) => postPlan(s, g.id, { id: uid(), title: title.trim(), where: where.trim() || "Location TBD", note: note.trim(), placeId, byId: me!.id, auto, price: typed, est, tag, people: ins?.people, options }));
    go("group", { groupId: g.id, tab: "votes" });
    toast(`Shared with ${g.name}. Everyone sees it now.`);
  };

  return (
    <>
      <button className="back" onClick={() => go("group", { groupId: g.id })}>
        <Icon name="chevL" /> Back to {g.name}
      </button>
      <div className="page-head">
        <div>
          <h1>Get something on the calendar.</h1>
          <p className="sub">Post the plan once. Friends answer each time, and the host locks in the winner.</p>
        </div>
      </div>
      <div className="grid-side">
        <section className="card pad-lg form">
          <h2>The plan</h2>
          <label className="f">
            <span>What are we doing?</span>
            <input className={`field${bad === "title" ? " err" : ""}`} value={title} onChange={(e) => (setTitle(e.target.value), setBad(null))} placeholder="Dinner at Domino's for five of us" autoFocus />
            {tag && (
              <span className="row gap" style={{ marginTop: 8 }}>
                <button type="button" className="tag" title="Remove tag" onClick={() => setTagOff(true)}>
                  #{tag} <Icon name="x" />
                </button>
                <small className="hint" style={{ margin: 0 }}>
                  {ins?.source === "gemini" ? "Tagged by Gemini" : "Auto tag"}
                </small>
              </span>
            )}
          </label>
          <div className="f">
            <span>Where?</span>
            <PlaceSearch
              data={data}
              value={where}
              picked={spot}
              onText={(v) => {
                setWhere(v);
                setPlaceId(undefined);
              }}
              onPick={pick}
              placeholder="Search Boston places, or type anything"
            />
          </div>
          <label className="f">
            <span>
              Cost per person <em>optional</em>
            </span>
            <div className="money-in">
              <span>$</span>
              <input className={`field${bad === "price" ? " err" : ""}`} type="number" min={0} step={1} inputMode="decimal" placeholder="Leave blank to use the estimate" value={price} onChange={(e) => (setPrice(e.target.value), setBad(null))} />
            </div>
            <small className="hint">
              {!est || !ins
                ? ins?.loading
                  ? "Asking Gemini…"
                  : "Describe the plan or add a place and we can estimate the cost."
                : `${ins.source === "gemini" ? "Gemini estimate" : "Rough estimate"}: ${fmtRange(est)} per person · ${fmtRange(totalRange(est, ins.people))} total for ${ins.people}${ins.loading ? " · updating…" : ""}`}
              {ins?.source === "gemini" && ins.basis && (
                <>
                  <br />
                  {ins.basis}
                </>
              )}
            </small>
          </label>
          <div className="f2">
            <label className="f">
              <span>Date</span>
              <input type="date" className={`field${bad === "date" ? " err" : ""}`} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="f">
              <span>Time</span>
              <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          {alt ? (
            <div className="f2">
              <label className="f">
                <span>Second date</span>
                <input type="date" className="field" value={date2} onChange={(e) => setDate2(e.target.value)} />
              </label>
              <label className="f">
                <span>Second time</span>
                <input type="time" className="field" value={time2} onChange={(e) => setTime2(e.target.value)} />
              </label>
            </div>
          ) : (
            <button className="link" type="button" onClick={() => setAlt(true)} style={{ margin: "-6px 0 18px" }}>
              <Icon name="plus" /> Offer a second time
            </button>
          )}
          <label className="f">
            <span>
              A little context <em>optional</em>
            </span>
            <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Let's try something new!" />
          </label>
          <label className="f" style={{ margin: 0 }}>
            <span>Your group</span>
            <select className="field" value={g.id} onChange={(e) => setGid(e.target.value)}>
              {myGroups.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.memberIds.length} friends
                </option>
              ))}
            </select>
          </label>
          <label className="check-row" style={{ margin: 0 }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span>Auto-confirm the recommended time when voting closes</span>
          </label>
        </section>
        <aside className="stack">
          <TryNext g={g} onPick={pick} />
          <section className="card pad steps">
            <h3>
              Less back-and-forth.
              <br />
              More getting out.
            </h3>
            <ol>
              <li>
                <b>01</b>
                <div>
                  <strong>Share the plan</strong>
                  <span>Everyone in your group sees it instantly.</span>
                </div>
              </li>
              <li>
                <b>02</b>
                <div>
                  <strong>Answer every time</strong>
                  <span>Yes, partly, if needed, or no. The host has to be free.</span>
                </div>
              </li>
              <li>
                <b>03</b>
                <div>
                  <strong>Confirm the winner</strong>
                  <span>The host locks it in, or it confirms itself when voting closes. Faster still earns more points.</span>
                </div>
              </li>
            </ol>
          </section>
          <section className="card pad">
            <h3>Ready for the group?</h3>
            <p className="muted small" style={{ marginTop: 4 }}>
              You're the host, so your Yes goes in automatically. Voting closes in 24 hours, or 2 hours before the earliest time if that's sooner.
            </p>
            <div className="preview">
              <div>
                <span>Plan</span>
                <span>{title || "—"}</span>
              </div>
              <div>
                <span>Time option 1</span>
                <span>
                  {date ? fmtD(date, { weekday: "short", month: "short", day: "numeric" }) : "—"} · {fmtT(time)}
                </span>
              </div>
              {alt && (
                <div>
                  <span>Time option 2</span>
                  <span>
                    {date2 ? fmtD(date2, { weekday: "short", month: "short", day: "numeric" }) : "—"} · {fmtT(time2)}
                  </span>
                </div>
              )}
              <div>
                <span>Cost per person</span>
                <span>{price.trim() !== "" ? (Number(price) ? `$${Math.round(Number(price))}` : "Free") : est ? `~${fmtRange(est)} (est.)` : "—"}</span>
              </div>
              {tag && (
                <div>
                  <span>Tag</span>
                  <span>#{tag}</span>
                </div>
              )}
              <div>
                <span>Sending to</span>
                <span>
                  {g.name} · {g.memberIds.length - 1} friends
                </span>
              </div>
              {g.plan && (
                <div>
                  <span>Replaces</span>
                  <span>{g.plan.title}</span>
                </div>
              )}
            </div>
            <button className="btn btn-primary block" onClick={share}>
              Share with your group <Icon name="arrow" />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
