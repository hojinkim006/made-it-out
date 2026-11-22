import { useState } from "react";
import { useStore } from "../store";
import { useNav, type GroupTab } from "../nav";
import { CatIcon, Icon } from "../components/Icons";
import { Seg } from "../components/Sheet";
import { MAX_FRUIT } from "../components/Tree";
import { TreeStage } from "../components/TreeStage";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { InviteSheet, LogSheet, NewGroupSheet } from "../components/GroupSheets";
import { boardRows, isDuo, nextStageIn } from "../lib/scoring";
import { daysAgo, fmtD, todayISO } from "../lib/dates";
import { avgRating, rateLog, spendOf } from "../lib/budget";
import { groupInfo, since } from "../lib/groupInfo";
import { needsHost, responded, waitingIds } from "../lib/plans";
import { CostTag, Stars } from "../components/Stars";
import type { ActivityLog, Plan } from "../lib/types";
import { COMPETITORS } from "../data/seed";
import { TryNext } from "../components/TryNext";
import { NextUp, VotesTab } from "./Votes";

const fmtN = (n: number) => n.toLocaleString("en-US");

export function GroupPage() {
  const { me, state, board, myGroups } = useStore();
  const { route, go } = useNav();
  const [sheet, setSheet] = useState<"invite" | "new" | null>(null);
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
    ? boardRows("duos", board.groups, board.logs, COMPETITORS.duos, {})
    : boardRows("local", board.groups, board.logs, COMPETITORS.local, { region: g.region });
  const rank = rows.find((r) => r.id === g.id)?.rank;
  const tab: GroupTab = route.tab ?? "overview";
  const p = g.plan;
  const needMe = !!p && me && (!responded(p, me.id) || (p.hostId === me.id && needsHost(p).length > 0));
  const waiting = p ? waitingIds(g.memberIds, p).length : 0;
  const n = logs.length;
  const nextStage = nextStageIn(ageDays);

  return (
    <>
      <div className="crumbs">
        <button onClick={() => go("profile")}>Your trees</button>
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
            <Icon name="plus" /> Post an event
          </button>
        </div>
      </div>
      <div className="subtabs">
        <Seg
          value={tab}
          onChange={(t) => go("group", { groupId: g.id, tab: t })}
          options={[
            { key: "overview", label: "Overview" },
            { key: "votes", label: <>Votes{needMe ? <span className="dotb" /> : p && !p.confirmedOptionId && waiting > 0 ? ` · ${waiting}` : ""}</> },
          ]}
        />
      </div>

      {tab === "votes" ? (
        <VotesTab g={g} />
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
                  {n >= MAX_FRUIT ? (
                    <span>Fully branched out.</span>
                  ) : (
                    <>
                      <b>{n}</b> {n === 1 ? "branch" : "branches"} <span className="muted">· each hangout grows the tree</span>
                    </>
                  )}
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, (n / MAX_FRUIT) * 100)}%` }} />
                </div>
                <div className="ms-text muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  {nextStage ? `${nextStage.stage} in ${nextStage.days} days` : "Fully grown"}
                </div>
              </div>
            </div>
            <ErrorBoundary fallback={<p className="muted map-msg" style={{ position: "static", padding: 40 }}>The tree couldn't be drawn. The rest of the page still works; check the console for details.</p>}>
              <TreeStage logs={logs} meId={me?.id} stage={stage} health={h} grow={route.grow} highlight={hl} onOpen={(i) => setOpenLog(i)} />
            </ErrorBoundary>
            <div className="tree-cap">
              {n ? (
                <>
                  <h3>{h.leaves > 0 ? "Rooted in good company." : h.shrink < 1 ? "This tree misses you." : "Time to get out again."}</h3>
                  <p className="muted">
                    {n} {n === 1 ? "hangout" : "hangouts"} · {h.leaves} green {h.leaves === 1 ? "leaf" : "leaves"}. Streaks add leaves; quiet weeks take them away.
                  </p>
                </>
              ) : (
                <>
                  <h3>Plant the first seed.</h3>
                  <p className="muted">Log your first hangout and a branch will grow.</p>
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
                <span>Hangouts logged</span>
              </div>
            </div>
          </section>

          <div className="grid-2">
            <div className="stack">
              <NextUp g={g} />
              <HowWasIt logs={logs} onOpen={setOpenLog} />
              <BudgetCard logs={logs} plan={p} />
              <TryNext g={g} />
            </div>
            <section className="card pad">
              <div className="card-head">
                <div>
                  <h2>Hangouts</h2>
                  <p className="muted">Every hangout, every branch.</p>
                </div>
                <button className="btn btn-soft sm" onClick={() => go("log", { groupId: g.id })}>
                  <Icon name="plus" /> Log a hangout
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
                            {avgRating(l.ratings) != null && (
                              <>
                                {" "}
                                · <span className="gold">★</span> {avgRating(l.ratings)!.toFixed(1)}
                              </>
                            )}
                            {l.comments.length > 0 && ` · ${l.comments.length} ${l.comments.length === 1 ? "comment" : "comments"}`}
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
                  <p>No hangouts yet. Your first one grows your first branch.</p>
                  <button className="btn btn-primary sm" onClick={() => go("log", { groupId: g.id })}>
                    Log a hangout
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {sheet === "invite" && <InviteSheet groupId={g.id} onClose={() => setSheet(null)} />}
      {sheet === "new" && <NewGroupSheet onClose={() => setSheet(null)} />}
      {openLog !== null && <LogSheet logs={logs} index={openLog} onClose={() => setOpenLog(null)} onNav={setOpenLog} />}
    </>
  );
}

function HowWasIt({ logs, onOpen }: { logs: ActivityLog[]; onOpen: (i: number) => void }) {
  const { me, update, toast } = useStore();
  if (!me) return null;
  const today = todayISO();
  const cutoff = daysAgo(21);
  const rows = logs
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.attendeeIds.includes(me.id) && !l.ratings[me.id] && l.date >= cutoff && l.date <= today)
    .reverse()
    .slice(0, 3);
  if (!rows.length) return null;
  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>How was it?</h2>
          <p className="muted">Your ratings shape the group's suggestions.</p>
        </div>
      </div>
      <div className="rate-list">
        {rows.map(({ l, i }) => {
          const avg = avgRating(l.ratings);
          return (
            <div className="rate-item" key={l.id}>
              <span className="ico">
                <CatIcon cat={l.cat} />
              </span>
              <button className="t" onClick={() => onOpen(i)}>
                <b>{l.title}</b>
                <span className="muted">
                  {fmtD(l.date, { month: "short", day: "numeric" })}
                  {avg != null && ` · group ${avg.toFixed(1)}★`}
                </span>
              </button>
              <Stars
                small
                value={0}
                onRate={(n) => {
                  update((s) => rateLog(s, l.id, me.id, n));
                  toast(`Rated ${n}★`);
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BudgetCard({ logs, plan }: { logs: ActivityLog[]; plan: Plan | null }) {
  const { me } = useStore();
  if (!me) return null;
  const spent = spendOf(logs, me.id);
  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Budget</h2>
          <p className="muted">What getting out has cost, per person.</p>
        </div>
      </div>
      <div className="budget">
        <div>
          <b>
            {spent.est ? "~" : ""}${Math.round(spent.mine)}
          </b>
          <span>
            You, last 30 days · {spent.n} {spent.n === 1 ? "hangout" : "hangouts"}
          </span>
        </div>
        <div>
          <b>~${Math.round(spent.avg)}</b>
          <span>Group average per hangout</span>
        </div>
      </div>
      {plan && (
        <p className="hint-line">
          Next up: {plan.title} <CostTag item={plan} />
        </p>
      )}
      <p className="hint-line">Prices people entered count as-is. Everything else uses the estimate: Gemini when GEMINI_API_KEY is set, otherwise a built-in price list.</p>
    </section>
  );
}

