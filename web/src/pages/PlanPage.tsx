import { useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { Icon } from "../components/Icons";
import { fmtD, fmtT, nextFriday } from "../lib/dates";
import { postPlan } from "../lib/plans";

export function PlanPage() {
  const { me, myGroups, update, toast } = useStore();
  const { route, go } = useNav();
  const [gid, setGid] = useState(route.groupId ?? myGroups[0]?.id);
  const [title, setTitle] = useState("");
  const [where, setWhere] = useState("");
  const [date, setDate] = useState(nextFriday());
  const [time, setTime] = useState("18:30");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState<string | null>(null);
  const g = myGroups.find((x) => x.id === gid) ?? myGroups[0];
  if (!g) return <p className="muted">Create a group first.</p>;

  const share = () => {
    if (!title.trim()) return setBad("title");
    if (!date) return setBad("date");
    update((s) => postPlan(s, g.id, { id: uid(), title: title.trim(), where: where.trim() || "Location TBD", date, time: time || "18:00", note: note.trim(), byId: me!.id }));
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
          <p className="sub">A good idea is all it takes. Your friends can accept or vote on a new time.</p>
        </div>
      </div>
      <div className="grid-side">
        <section className="card pad-lg form">
          <h2>The plan</h2>
          <label className="f">
            <span>What are we doing?</span>
            <input className={`field${bad === "title" ? " err" : ""}`} value={title} onChange={(e) => (setTitle(e.target.value), setBad(null))} placeholder="Dinner" autoFocus />
          </label>
          <label className="f">
            <span>Where?</span>
            <input className="field" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Dumpling House · Cambridge" />
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
        </section>
        <aside className="stack">
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
                  <strong>Find your time</strong>
                  <span>Friends accept, or suggest and vote on a new time.</span>
                </div>
              </li>
              <li>
                <b>03</b>
                <div>
                  <strong>Lock it in fast</strong>
                  <span>The quicker it's confirmed, the more points it earns.</span>
                </div>
              </li>
            </ol>
          </section>
          <section className="card pad">
            <h3>Ready for the group?</h3>
            <p className="muted small" style={{ marginTop: 4 }}>
              This sends a proposal, not a final RSVP.
            </p>
            <div className="preview">
              <div>
                <span>Plan</span>
                <span>{title || "—"}</span>
              </div>
              <div>
                <span>When</span>
                <span>
                  {date ? fmtD(date, { weekday: "short", month: "short", day: "numeric" }) : "—"} · {fmtT(time)}
                </span>
              </div>
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
