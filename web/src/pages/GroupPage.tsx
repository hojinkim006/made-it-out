import { useState } from "react";
import { useStore, uid } from "../store";
import { useNav, type GroupTab } from "../nav";
import { Avatar, CatIcon, Icon } from "../components/Icons";
import { Seg, Sheet } from "../components/Sheet";
import { nextMilestone, Tree } from "../components/Tree";
import { InviteSheet, LogSheet, NewGroupSheet } from "../components/GroupSheets";
import { boardRows, isDuo, nextStageIn } from "../lib/scoring";
import { fmtD, fmtT, MON, parseD } from "../lib/dates";
import { groupInfo, since } from "../lib/groupInfo";
import { adoptSuggestion, cancelPlan, lockIn, memberStatus, respond, suggestTime, toggleVote, type MemberStatus } from "../lib/plans";
import { COMPETITORS } from "../data/seed";
import { TryNext } from "../components/TryNext";
import type { Group, Plan } from "../lib/types";

const fmtN = (n: number) => n.toLocaleString("en-US");

export function GroupPage() {
  const { me, state, myGroups, nameOf } = useStore();
  const { route, go } = useNav();
  const [sheet, setSheet] = useState<"invite" | "new" | "suggest" | "bud" | null>(null);
  const [openLog, setOpenLog] = useState<number | null>(null);
  const [hl, setHl] = useState<number | null>(null);

  const g = myGroups.find((x) => x.id === route.groupId) ?? myGroups[0];
  if (!g) {
    return (
      <div className="card pad-lg empty">
        <h2>No groups yet.</h2>
        <p>Add friends by username on your profile, then plant your first tree.</p>
        <button className="btn btn-primary sm" onClick={() => setSheet("new")}>
          <Icon name="plus" /> Create a group
        </button>
        {sheet === "new" && <NewGroupSheet onClose={() => setSheet(null)} />}
      </div>
    );
  }

  const info = groupInfo(state, g);
  const { logs, score, stage, ageDays } = info;
  const h = score.health;
  const duo = isDuo(g);
  const rows = duo
    ? boardRows("duos", state.groups, state.logs, COMPETITORS.duos, {})
    : boardRows("local", state.groups, state.logs, COMPETITORS.local, { region: g.region });
  const rank = rows.find((r) => r.id === g.id)?.rank;
  const tab: GroupTab = route.tab ?? "overview";
  const p = g.plan;
  const waiting = p ? g.memberIds.filter((m) => memberStatus(p, m) === "waiting").length : 0;
  const n = logs.length;
  const ms = nextMilestone(n);
  const nextStage = nextStageIn(ageDays);

  return (
    <>
      <div className="crumbs">
        <button onClick={() => go("profile")}>Your groups</button>
        <span>/</span>
        <span>{g.name}</span>
      </div>
      <div className="page-head">
        <div>
          <h1>{g.name}</h1>
          <p className="sub">
            {g.memberIds.length} friends · {g.hood} · Growing together since {since(g)}
          </p>
        </div>
        <div className="row gap">
          <button className="btn btn-secondary" onClick={() => setSheet("invite")}>
            <Icon name="person" /> Invite friends
          </button>
          <button className="btn btn-primary" onClick={() => go("plan", { groupId: g.id })}>
            <Icon name="plus" /> Plan a hangout
          </button>
        </div>
      </div>
      <div className="gswitch">
        {myGroups.map((x) => (
          <button key={x.id} className={`chip${x.id === g.id ? " on" : ""}`} onClick={() => go("group", { groupId: x.id, tab })}>
            {x.name}
          </button>
        ))}
        <button className="chip ghost" onClick={() => setSheet("new")}>
          <Icon name="plus" /> New group
        </button>
      </div>
      <div className="subtabs">
        <Seg
          value={tab}
          onChange={(t) => go("group", { groupId: g.id, tab: t })}
          options={[
            { key: "overview", label: "Overview" },
            { key: "votes", label: <>Votes{p && waiting > 0 ? ` · ${waiting} waiting` : ""}</> },
          ]}
        />
      </div>

      {tab === "votes" ? (
        <VotesTab g={g} onSuggest={() => setSheet("suggest")} />
      ) : (
        <>
          <section className="card tree-card">
            <div className="tree-top">
              <div>
                <div className="eyebrow">Your group tree</div>
                <div className="stage">{stage}</div>
                <div className="health">
                  <span className={`badge ${h.status === "Thriving" || h.status === "Healthy" ? "green" : h.status === "Quiet" || h.status === "New" ? "soft" : h.status === "Wilting" ? "amber" : "red"}`}>
                    <Icon name="leaf" size={12} /> {h.status}
                  </span>
                  {h.weeklyStreak >= 2 && <span className="badge soft">{h.weeklyStreak}-week streak</span>}
                  {h.dailyStreak >= 2 && <span className="badge soft">{h.dailyStreak}-day streak</span>}
                  {h.decay > 0 && <span className="badge red">−{h.decay} pts decay</span>}
                </div>
              </div>
              <div className="milestone">
                <div className="ms-text">
                  <b>{n}</b> of {ms} outings <span className="muted">to the next branch milestone</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, (n / ms) * 100)}%` }} />
                </div>
                <div className="ms-text muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  {nextStage ? `${nextStage.stage} in ${nextStage.days} days` : "Fully grown"}
                </div>
              </div>
            </div>
            <Tree
              logs={logs}
              stage={stage}
              health={h}
              grow={route.grow}
              highlight={hl}
              onFruit={(i) => setOpenLog(i)}
              onBud={() => setSheet("bud")}
            />
            <div className="tree-cap">
              {n ? (
                <>
                  <h3>{h.leaves > 0 ? "Rooted in good company." : h.shrink < 1 ? "This tree misses you." : "Time to get out again."}</h3>
                  <p className="muted">
                    {n} {n === 1 ? "memory" : "memories"} · {h.leaves} green {h.leaves === 1 ? "leaf" : "leaves"}. Streaks add leaves; quiet weeks take them away.
                  </p>
                </>
              ) : (
                <>
                  <h3>Plant the first seed.</h3>
                  <p className="muted">Log your first outing and a branch will grow.</p>
                </>
              )}
            </div>
            <div className="tree-stats">
              <div>
                <b>{fmtN(score.total)}</b>
                <span>Group points</span>
              </div>
              <div>
                <b>#{rank}</b>
                <span>{duo ? "In Duos" : `In ${g.region.split(",")[0]}`}</span>
              </div>
              <div>
                <b>{n}</b>
                <span>Outings logged</span>
              </div>
            </div>
          </section>

          <div className="grid-2">
            <div className="stack">
              <NextUp g={g} onSuggest={() => setSheet("suggest")} />
              <TryNext g={g} />
              <section className="card pad">
                <div className="card-head">
                  <div>
                    <h2>The whole crew</h2>
                    <p className="muted">Everyone who helps this tree grow.</p>
                  </div>
                  <button className="link" onClick={() => setSheet("invite")}>
                    <Icon name="plus" /> Invite
                  </button>
                </div>
                <div className="crew">
                  {g.memberIds.map((m) => {
                    const c = logs.filter((l) => l.attendeeIds.includes(m)).length;
                    const pts = logs.filter((l) => l.authorId === m).reduce((a, l) => a + l.points.total, 0);
                    return (
                      <div className="crew-row" key={m}>
                        <Avatar name={nameOf(m)} me={m === me!.id} />
                        <span className="nm">
                          {m === me!.id ? me!.displayName : nameOf(m)}
                          {m === me!.id && <span className="muted"> (you)</span>}
                        </span>
                        <span className="muted">
                          {c} {c === 1 ? "outing" : "outings"} · {fmtN(pts)} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <section className="card pad">
              <div className="card-head">
                <div>
                  <h2>The memory trail</h2>
                  <p className="muted">Every outing, every branch.</p>
                </div>
                <button className="btn btn-soft sm" onClick={() => go("log", { groupId: g.id })}>
                  <Icon name="plus" /> Log activity
                </button>
              </div>
              {n ? (
                <div className="trail">
                  {[...logs].reverse().map((l) => {
                    const i = logs.indexOf(l);
                    return (
                      <button key={l.id} className="trail-item" onClick={() => setOpenLog(i)} onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)}>
                        <span className="ico">
                          <CatIcon cat={l.cat} />
                        </span>
                        <span className="t">
                          <b>{l.title}</b>
                          <span className="muted">
                            {fmtD(l.date, { month: "short", day: "numeric" })} · {l.where.split("·")[0].trim() || "—"} · {l.attendeeIds.length} friends
                            {l.labels.length > 0 && ` · ${l.labels.map((t) => "#" + t).join(" ")}`}
                            {l.media.length > 0 && ` · ${l.media.length} 📷`}
                          </span>
                        </span>
                        <span className="pts">+{l.points.total}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">
                  <p>No memories yet. Your first outing grows your first branch.</p>
                  <button className="btn btn-primary sm" onClick={() => go("log", { groupId: g.id })}>
                    Log an outing
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {sheet === "invite" && <InviteSheet groupId={g.id} onClose={() => setSheet(null)} />}
      {sheet === "new" && <NewGroupSheet onClose={() => setSheet(null)} />}
      {sheet === "suggest" && p && <SuggestSheet g={g} plan={p} onClose={() => setSheet(null)} />}
      {sheet === "bud" && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="sheet-hero">
            <span className="ico" style={{ background: "var(--fill)", color: "var(--ink)" }}>
              <Icon name="spark" />
            </span>
            <h2>A branch is waiting.</h2>
            <p className="meta">This spot on your tree fills in with your next outing.</p>
          </div>
          <button className="btn btn-primary block" onClick={() => go("log", { groupId: g.id })}>
            Log an outing <Icon name="arrow" />
          </button>
        </Sheet>
      )}
      {openLog !== null && <LogSheet logs={logs} index={openLog} onClose={() => setOpenLog(null)} onNav={setOpenLog} />}
    </>
  );
}

function NextUp({ g, onSuggest }: { g: Group; onSuggest: () => void }) {
  const { me, update, nameOf, toast } = useStore();
  const { go } = useNav();
  const p = g.plan;
  if (!p)
    return (
      <section className="card pad">
        <div className="card-head">
          <div>
            <h2>Next up</h2>
            <p className="muted">One plan. Everyone on the same page.</p>
          </div>
        </div>
        <div className="empty">
          <p>Nothing on the calendar yet.</p>
          <button className="btn btn-primary sm" onClick={() => go("plan", { groupId: g.id })}>
            Plan a hangout
          </button>
        </div>
      </section>
    );
  const d = parseD(p.date);
  const st = memberStatus(p, me!.id);
  const waiting = g.memberIds.filter((m) => memberStatus(p, m) === "waiting").length;
  const answer = (a: "in" | "out") => {
    update((s) => respond(s, g.id, me!.id, st === a ? "clear" : a));
    toast(a === "in" ? (st === "in" ? "Answer cleared" : `You're in for ${p.title}`) : st === "out" ? "Answer cleared" : "Marked as can't make it");
  };
  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Next up</h2>
          <p className="muted">One plan. Everyone on the same page.</p>
        </div>
        {p.confirmedAt ? <span className="badge green">Locked in</span> : <span className="badge soft">Voting</span>}
      </div>
      <div className="event">
        <div className="dtile">
          <span>{MON[d.getMonth()]}</span>
          <b>{d.getDate()}</b>
        </div>
        <div className="ev-body">
          <h3>{p.title}</h3>
          <p className="muted">
            {fmtD(p.date, { weekday: "long" })} · {fmtT(p.time)} · {p.where.split("·")[0].trim() || "Location TBD"}
          </p>
          <p className="muted">
            Proposed by {nameOf(p.byId)} · {p.inIds.length} going · {waiting} haven't answered
          </p>
        </div>
      </div>
      {p.suggestions.length > 0 && (
        <div className="note-line">
          <Icon name="clock" /> {p.suggestions.length} time {p.suggestions.length > 1 ? "suggestions" : "suggestion"} to vote on
        </div>
      )}
      <div className="row gap mt" style={{ flexWrap: "wrap" }}>
        <button className={`btn ${st === "in" ? "btn-secondary" : "btn-primary"} sm`} onClick={() => answer("in")}>
          {st === "in" ? (
            <>
              <Icon name="check" /> You're in
            </>
          ) : (
            "I'm in"
          )}
        </button>
        <button className="btn btn-secondary sm" onClick={onSuggest}>
          Suggest a time
        </button>
        <button className="link ml-auto" onClick={() => go("group", { groupId: g.id, tab: "votes" })}>
          See votes <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}

const STATUS_LABEL: Record<MemberStatus, string> = { in: "In", out: "Can't make it", suggested: "Suggested a time", waiting: "Hasn't answered" };

function VotesTab({ g, onSuggest }: { g: Group; onSuggest: () => void }) {
  const { me, update, nameOf, toast } = useStore();
  const { go } = useNav();
  const p = g.plan;
  if (!p)
    return (
      <div className="card pad-lg empty">
        <h2>No votes open.</h2>
        <p>Post a plan and your group can accept it or vote on a new time.</p>
        <button className="btn btn-primary sm" onClick={() => go("plan", { groupId: g.id })}>
          Plan a hangout
        </button>
      </div>
    );
  const mine = p.byId === me!.id;
  const total = g.memberIds.length;
  const st = memberStatus(p, me!.id);

  return (
    <div className="votes-grid">
      <section className="card pad">
        <div className="card-head">
          <div>
            <h2>Vote on the time</h2>
            <p className="muted">Accept the plan, or back a different time. No chat, just votes.</p>
          </div>
          <button className="btn btn-soft sm" onClick={onSuggest}>
            <Icon name="clock" /> Suggest a time
          </button>
        </div>
        <div className="vote-row">
          <div className="t">
            <b>
              {fmtD(p.date, { weekday: "short", month: "short", day: "numeric" })}, {fmtT(p.time)} <span className="badge">Current</span>
            </b>
            <span className="muted">
              Proposed by {nameOf(p.byId)} · {p.inIds.length} of {total} in: {p.inIds.map(nameOf).join(", ") || "—"}
            </span>
            <div className="vbar">
              <i style={{ width: `${(p.inIds.length / total) * 100}%` }} />
            </div>
          </div>
          <button
            className={`btn ${st === "in" ? "btn-secondary" : "btn-primary"} sm`}
            onClick={() => {
              update((s) => respond(s, g.id, me!.id, st === "in" ? "clear" : "in"));
              toast(st === "in" ? "Answer cleared" : `You're in for ${p.title}`);
            }}
          >
            {st === "in" ? (
              <>
                <Icon name="check" /> In
              </>
            ) : (
              "Accept"
            )}
          </button>
        </div>
        {p.suggestions.map((s) => {
          const voted = s.voterIds.includes(me!.id);
          return (
            <div className="vote-row" key={s.id}>
              <div className="t">
                <b>
                  {fmtD(s.date, { weekday: "short", month: "short", day: "numeric" })}, {fmtT(s.time)}
                </b>
                <span className="muted">
                  Suggested by {nameOf(s.byId)} · {s.voterIds.length} {s.voterIds.length === 1 ? "vote" : "votes"}: {s.voterIds.map(nameOf).join(", ")}
                </span>
                <div className="vbar">
                  <i style={{ width: `${(s.voterIds.length / total) * 100}%` }} />
                </div>
              </div>
              <div className="row gap">
                <button className={`btn ${voted ? "btn-primary" : "btn-secondary"} sm`} onClick={() => update((st2) => toggleVote(st2, g.id, me!.id, s.id))}>
                  {voted ? (
                    <>
                      <Icon name="check" /> Voted
                    </>
                  ) : (
                    "Vote"
                  )}
                </button>
                {mine && (
                  <button
                    className="btn btn-soft sm"
                    onClick={() => {
                      update((st2) => adoptSuggestion(st2, g.id, s.id));
                      toast(`Moved to ${fmtD(s.date, { weekday: "short", month: "short", day: "numeric" })}, ${fmtT(s.time)}`);
                    }}
                  >
                    Use this time
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <h2 style={{ margin: "26px 0 8px" }}>Who's answered</h2>
        {g.memberIds.map((m) => {
          const ms = memberStatus(p, m);
          return (
            <div className="vote-row" key={m}>
              <Avatar name={nameOf(m)} me={m === me!.id} />
              <div className="t">
                <b>{nameOf(m)}</b>
              </div>
              <span className={`status-pill ${ms === "suggested" ? "alt" : ms}`}>{STATUS_LABEL[ms]}</span>
            </div>
          );
        })}
      </section>
      <aside className="stack">
        <NextUp g={g} onSuggest={onSuggest} />
        <section className="card pad">
          <h3>{p.confirmedAt ? "It's happening." : "Make it official."}</h3>
          <p className="muted small" style={{ margin: "4px 0 16px" }}>
            {p.confirmedAt
              ? "Locked in. After you go, log it to grow your tree. Quick plans earn finalization-speed points."
              : "Plans lock in when everyone's in, or when the proposer locks it. The faster it's locked, the more points."}
          </p>
          {p.confirmedAt ? (
            <button className="btn btn-primary block" onClick={() => go("log", { groupId: g.id })}>
              Log this hangout <Icon name="arrow" />
            </button>
          ) : mine ? (
            <button
              className="btn btn-primary block"
              onClick={() => {
                update((s) => lockIn(s, g.id));
                toast(`${p.title} is locked in`);
              }}
            >
              Lock it in <Icon name="check" />
            </button>
          ) : (
            <p className="muted small">Only {nameOf(p.byId)} can lock it in early.</p>
          )}
          {mine && (
            <button
              className="btn btn-secondary block mt"
              onClick={() => {
                if (confirm("Cancel this plan for everyone?")) {
                  update((s) => cancelPlan(s, g.id));
                  toast("Plan cancelled");
                }
              }}
            >
              Cancel plan
            </button>
          )}
          {!mine && st !== "out" && (
            <button
              className="btn btn-secondary block mt"
              onClick={() => {
                update((s) => respond(s, g.id, me!.id, "out"));
                toast("Marked as can't make it");
              }}
            >
              Can't make it
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function SuggestSheet({ g, plan, onClose }: { g: Group; plan: Plan; onClose: () => void }) {
  const { me, update, toast } = useStore();
  const [date, setDate] = useState(plan.date);
  const [time, setTime] = useState(plan.time);
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>Suggest a time</h2>
        <p className="meta">Your group sees it right away and can vote on it.</p>
      </div>
      <div className="f2">
        <label className="f">
          <span>Date</span>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="f">
          <span>Time</span>
          <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <button
        className="btn btn-primary block"
        onClick={() => {
          if (!date) return;
          if (date === plan.date && time === plan.time) {
            update((s) => respond(s, g.id, me!.id, "in"));
            toast("That's the current time, so you're in");
          } else {
            update((s) => suggestTime(s, g.id, me!.id, date, time || plan.time, uid()));
            toast(`Suggested ${fmtD(date, { weekday: "short", month: "short", day: "numeric" })}, ${fmtT(time)}`);
          }
          onClose();
        }}
      >
        Send suggestion <Icon name="arrow" />
      </button>
    </Sheet>
  );
}
