import { useState } from "react";
import { useStore } from "../store";
import { useNav } from "../nav";
import { Avatar, CatIcon, Icon } from "../components/Icons";
import { Grove } from "../components/Grove";
import { LogSheet, NewGroupSheet } from "../components/GroupSheets";
import { findUser } from "../lib/auth";
import { fmtD, fmtT, MON, parseD } from "../lib/dates";
import { groupInfo } from "../lib/groupInfo";
import { activeOption, comingTo, responded, waitingIds } from "../lib/plans";
import type { Group, Plan } from "../lib/types";

export function ProfilePage() {
  const { me, state, myGroups } = useStore();
  const { go } = useNav();
  const [sheet, setSheet] = useState<"new" | null>(null);
  const [open, setOpen] = useState<{ logs: typeof state.logs; i: number } | null>(null);
  const u = me!;

  const recent = state.logs
    .filter((l) => myGroups.some((g) => g.id === l.groupId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  // The next plan, preferring one I haven't answered yet.
  const plans = myGroups.filter((g) => g.plan).map((g) => ({ g, p: g.plan! }));
  const up =
    plans.find(({ p }) => !responded(p, u.id)) ??
    [...plans].sort((a, b) => (activeOption(a.g.memberIds.length, a.p)?.date ?? "").localeCompare(activeOption(b.g.memberIds.length, b.p)?.date ?? ""))[0];

  const users = Object.fromEntries(state.users.map((person) => [person.id, person.displayName]));

  return (
    <>
      <Grove
        onOpen={(id) => go("group", { groupId: id })}
        onPlant={() => setSheet("new")}
        trees={myGroups.map((g) => {
          const info = groupInfo(state, g);
          return {
            group: g,
            stage: info.stage,
            health: info.score.health,
            logs: info.logs,
            friends: g.memberIds.filter((id) => id !== u.id).map((id) => ({ id, name: users[id] ?? "Friend" })),
          };
        })}
      />
      <div className="grid-side">
        <Friends />
        <aside className="stack">
          <section className="card horizon">
            <h2>Coming up</h2>
            {up ? (
              <Horizon plan={up} meId={u.id} />
            ) : (
              <div className="empty">
                <p>Nothing planned yet. Your next good story starts with a plan.</p>
                {myGroups[0] && (
                  <button className="btn btn-primary sm" onClick={() => go("plan", { groupId: myGroups[0].id })}>
                    Plan a hangout
                  </button>
                )}
              </div>
            )}
          </section>
          <section className="card pad">
            <div className="card-head">
              <div>
                <h2>Recent hangouts</h2>
              </div>
            </div>
            <div className="mini-list">
              {recent.length === 0 && <p className="muted small">No logs yet.</p>}
              {recent.map((l) => {
                const g = state.groups.find((x) => x.id === l.groupId)!;
                const glogs = groupInfo(state, g).logs;
                return (
                  <button key={l.id} className="mini-item" onClick={() => setOpen({ logs: glogs, i: glogs.findIndex((x) => x.id === l.id) })}>
                    <span className="ico">
                      <CatIcon cat={l.cat} />
                    </span>
                    <span className="t">
                      <b>{l.title}</b>
                      <span className="muted">
                        {fmtD(l.date, { month: "short", day: "numeric" })} · {g.name}
                      </span>
                    </span>
                    <span className="muted small">+{l.points.total}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
      {sheet === "new" && <NewGroupSheet onClose={() => setSheet(null)} />}
      {open && <LogSheet logs={open.logs} index={open.i} onClose={() => setOpen(null)} onNav={(i) => setOpen({ ...open, i })} />}
    </>
  );
}

function Friends() {
  const { me, state, update, toast } = useStore();
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const friends = state.users.filter((u) => me!.friendIds.includes(u.id));

  const add = () => {
    const name = q.trim().replace(/^@/, "").toLowerCase();
    const u = state.users.find((x) => x.username.toLowerCase() === name);
    if (!u) return setErr(findUser(state.users, q) ? "Add friends by their username" : `No one with the username @${name}`);
    if (u.id === me!.id) return setErr("That's you!");
    if (me!.friendIds.includes(u.id)) return setErr(`You're already friends with ${u.displayName}`);
    update((s) => {
      s.users.find((x) => x.id === me!.id)!.friendIds.push(u.id);
      const them = s.users.find((x) => x.id === u.id)!;
      if (!them.friendIds.includes(me!.id)) them.friendIds.push(me!.id);
    });
    setQ("");
    setErr("");
    toast(`You and ${u.displayName} are now friends`);
  };

  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Friends</h2>
        </div>
      </div>
      <form
        className="friend-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="field" placeholder="@username" value={q} onChange={(e) => (setQ(e.target.value), setErr(""))} />
        <button className="btn btn-primary sm">
          <Icon name="plus" /> Add
        </button>
      </form>
      {err && <p className="err-text" style={{ margin: "-4px 0 10px" }}>{err}</p>}
      <div className="crew">
        {friends.length === 0 && <p className="muted small">No friends yet.</p>}
        {friends.map((f) => (
          <div className="crew-row" key={f.id}>
            <Avatar name={f.displayName} />
            <span className="nm">{f.displayName}</span>
            <span className="muted">@{f.username}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Horizon({ plan, meId }: { plan: { g: Group; p: Plan }; meId: string }) {
  const { nameOf } = useStore();
  const { go } = useNav();
  const { g, p } = plan;
  const o = activeOption(g.memberIds.length, p);
  if (!o) return null;
  const when = p.confirmedOptionId ? p.start || o.time : o.time;
  const people = p.confirmedOptionId ? p.goingIds : comingTo(o);
  const waiting = waitingIds(g.memberIds, p).length;
  const d = parseD(o.date);
  return (
    <>
      <div className="ev-card">
        <div className="event">
          <div className="dtile">
            <span>{MON[d.getMonth()]}</span>
            <b>{d.getDate()}</b>
          </div>
          <div className="ev-body">
            <h3>{p.title}</h3>
            <p className="muted">
              {fmtD(o.date, { weekday: "short" })} · {fmtT(when)}
              {p.confirmedOptionId ? " · Confirmed" : p.options.length > 1 ? ` · leading of ${p.options.length} times` : ""}
            </p>
            <p className="muted">
              {p.where.split("·")[0].trim()} · {g.name}
            </p>
          </div>
        </div>
        <div className="ev-meta">
          <span className="avs">
            {people.slice(0, 5).map((id) => (
              <Avatar key={id} name={nameOf(id)} me={id === meId} />
            ))}
          </span>
          <span className="muted">
            {people.length} in · {p.confirmedOptionId ? "confirmed" : `${waiting} waiting`}
          </span>
        </div>
      </div>
      <button className="btn btn-primary block" onClick={() => go("group", { groupId: g.id, tab: "votes" })}>
        {responded(p, meId) ? "See the votes" : "Vote on a time"} <Icon name="arrow" />
      </button>
    </>
  );
}
