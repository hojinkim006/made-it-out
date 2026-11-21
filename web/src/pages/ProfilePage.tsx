import { useState } from "react";
import { useStore } from "../store";
import { useNav } from "../nav";
import { Avatar, CatIcon, Icon } from "../components/Icons";
import { Tree } from "../components/Tree";
import { LogSheet, NewGroupSheet } from "../components/GroupSheets";
import { findUser } from "../lib/auth";
import { boardRows, isDuo } from "../lib/scoring";
import { fmtD, fmtT, MON, parseD } from "../lib/dates";
import { groupInfo, myPoints } from "../lib/groupInfo";
import { COMPETITORS } from "../data/seed";

const fmtN = (n: number) => n.toLocaleString("en-US");

export function ProfilePage() {
  const { me, state, myGroups, nameOf } = useStore();
  const { go } = useNav();
  const [sheet, setSheet] = useState<"new" | null>(null);
  const [open, setOpen] = useState<{ logs: typeof state.logs; i: number } | null>(null);
  const u = me!;

  const myLogs = state.logs.filter((l) => l.attendeeIds.includes(u.id));
  const recent = state.logs
    .filter((l) => myGroups.some((g) => g.id === l.groupId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  // The next plan, preferring one I haven't answered yet.
  const plans = myGroups.filter((g) => g.plan).map((g) => ({ g, p: g.plan! }));
  const up =
    plans.find(({ p }) => !p.inIds.includes(u.id) && !p.outIds.includes(u.id)) ??
    plans.sort((a, b) => a.p.date.localeCompare(b.p.date))[0];

  const rankIn = (gid: string, duo: boolean) => {
    const rows = duo
      ? boardRows("duos", state.groups, state.logs, COMPETITORS.duos, {})
      : boardRows("local", state.groups, state.logs, COMPETITORS.local, { region: u.region });
    return rows.find((r) => r.id === gid)?.rank;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Your little corner</div>
          <h1>Good to see you, {u.displayName}.</h1>
          <p className="sub">Good friends. New places. More reasons to get out.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setSheet("new")}>
          <Icon name="plus" /> Create a group
        </button>
      </div>
      <div className="grid-side">
        <div className="stack">
          <div className="stats3">
            <div className="card stat">
              <div className="num">{myLogs.length}</div>
              <div className="lbl">Hangouts made it out to</div>
            </div>
            <div className="card stat">
              <div className="num">{myGroups.length}</div>
              <div className="lbl">Groups growing</div>
            </div>
            <div className="card stat">
              <div className="num">{fmtN(myPoints(state.logs, u.id))}</div>
              <div className="lbl">Points from your logs</div>
            </div>
          </div>
          <div className="sec-head">
            <div>
              <h2>Your groups</h2>
              <p className="muted">A little adventure looks good on you.</p>
            </div>
            {myGroups[0] && (
              <button className="link" onClick={() => go("group", { groupId: myGroups[0].id })}>
                View all groups <Icon name="arrow" />
              </button>
            )}
          </div>
          <div className="gcards">
            {myGroups.map((g) => {
              const info = groupInfo(state, g);
              const duo = isDuo(g);
              return (
                <article
                  key={g.id}
                  className="card gcard hoverable"
                  tabIndex={0}
                  onClick={() => go("group", { groupId: g.id })}
                  onKeyDown={(e) => e.key === "Enter" && go("group", { groupId: g.id })}
                >
                  <div className="gprev">
                    <Tree logs={info.logs} stage={info.stage} health={info.score.health} mini />
                  </div>
                  <div className="gbody">
                    <h3>{g.name}</h3>
                    <p className="muted">
                      {g.memberIds.length} friends · {g.hood} · {info.stage}
                    </p>
                    <p className="muted">
                      {info.logs.length} {info.logs.length === 1 ? "adventure" : "adventures"} · {info.score.health.status}
                    </p>
                  </div>
                  <div className="gfoot">
                    <span>
                      <b>{fmtN(info.score.total)}</b> pts
                    </span>
                    <span className="muted">
                      #{rankIn(g.id, duo)} {duo ? "in Duos" : `in ${u.region.split(",")[0]}`} <Icon name="chevR" />
                    </span>
                  </div>
                </article>
              );
            })}
            <button className="card gcard add" onClick={() => setSheet("new")}>
              <span className="plus">
                <Icon name="plus" />
              </span>
              Start a new group
            </button>
          </div>
        </div>
        <aside className="stack">
          <section className="card horizon">
            <div className="eyebrow">On the horizon</div>
            <h2>
              Something to look
              <br />
              forward to.
            </h2>
            {up ? (
              <>
                <div className="ev-card">
                  <div className="event">
                    <div className="dtile">
                      <span>{MON[parseD(up.p.date).getMonth()]}</span>
                      <b>{parseD(up.p.date).getDate()}</b>
                    </div>
                    <div className="ev-body">
                      <h3>{up.p.title}</h3>
                      <p className="muted">
                        {fmtD(up.p.date, { weekday: "short" })} · {fmtT(up.p.time)}
                      </p>
                      <p className="muted">{up.p.where.split("·")[0].trim()}</p>
                      <p className="muted">
                        {up.g.name} · by {nameOf(up.p.byId)}
                      </p>
                    </div>
                  </div>
                  <div className="ev-meta">
                    <span className="avs">
                      {up.p.inIds.slice(0, 5).map((id) => (
                        <Avatar key={id} name={nameOf(id)} me={id === u.id} />
                      ))}
                    </span>
                    <span className="muted">
                      {up.p.inIds.length} going · {up.g.memberIds.length - up.p.inIds.length - up.p.outIds.length} haven't answered
                    </span>
                  </div>
                </div>
                <button className="btn btn-primary block" onClick={() => go("group", { groupId: up.g.id, tab: "votes" })}>
                  {up.p.inIds.includes(u.id) || up.p.outIds.includes(u.id) ? "View hangout" : "Answer now"} <Icon name="arrow" />
                </button>
              </>
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
          <Friends />
          <section className="card pad">
            <div className="card-head">
              <div>
                <h2>Fresh memories</h2>
                <p className="muted">The latest fruit on your trees.</p>
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
          <p className="muted">You're @{me!.username}. Add friends by username.</p>
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
