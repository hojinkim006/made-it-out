import { useEffect, useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { Avatar, Icon } from "../components/Icons";
import { Sheet } from "../components/Sheet";
import { fmtD, fmtT, MON, parseD } from "../lib/dates";
import { turnoutPoints } from "../lib/scoring";
import {
  ANS,
  acceptRequest,
  activeOption,
  addTime,
  adjusted,
  cancelPlan,
  comingTo,
  confirm,
  deadlineOf,
  declineAll,
  declineRequest,
  dropOut,
  extendVoting,
  feedText,
  fmtLeft,
  isFree,
  fmtScore,
  handoff,
  hostOutAll,
  hostPickId,
  joinLate,
  lateNote,
  needOf,
  needsHost,
  optLabel,
  ranked,
  recommended,
  relTime,
  reopenVoting,
  setAnswer,
  setAuto,
  setHostPick,
  statusText,
  waitingIds,
} from "../lib/plans";
import { CostTag } from "../components/Stars";
import type { AnswerKind, Group, Plan, TimeOption } from "../lib/types";

function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function NextUp({ g }: { g: Group }) {
  const { me, update, nameOf, toast } = useStore();
  const { go } = useNav();
  const p = g.plan;
  if (!p)
    return (
      <section className="card pad">
        <div className="card-head">
          <div>
            <h2>Next up</h2>
            <p className="muted">One plan. Everyone answers each time.</p>
          </div>
        </div>
        <div className="empty">
          <p>Nothing on the calendar yet.</p>
          <button className="btn btn-primary sm" onClick={() => go("plan", { groupId: g.id })}>
            Post an event
          </button>
        </div>
      </section>
    );

  const n = g.memberIds.length;
  const o = activeOption(n, p)!;
  const when = p.confirmedOptionId ? p.start || o.time : o.time;
  const d = parseD(o.date);
  const mine = o.resp[me!.id]?.a;
  const waiting = waitingIds(g.memberIds, p).length;
  const rec = recommended(n, p);
  const people = p.confirmedOptionId ? p.goingIds : comingTo(o);
  const left = deadlineOf(p) - Date.now();
  const hostCalls = needsHost(p);

  const accept = () => {
    const result = { value: "noop" as string };
    update((s) => {
      result.value = setAnswer(s, g.id, me!.id, o.id, "yes");
    });
    toast(result.value === "cleared" ? "Answer cleared" : `Yes for ${optLabel(o)}`);
  };

  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Next up</h2>
          <p className="muted">One plan. Everyone answers each time.</p>
        </div>
        {p.confirmedOptionId ? <span className="tag ok">Confirmed</span> : rec?.id === o.id ? <span className="tag ok">Recommended</span> : <span className="tag">Voting</span>}
      </div>
      <div className="event">
        <div className="dtile">
          <span>{MON[d.getMonth()]}</span>
          <b>{d.getDate()}</b>
        </div>
        <div className="ev-body">
          <h3>{p.title}</h3>
          <p className="muted">
            {fmtD(o.date, { weekday: "long" })} · {fmtT(when)} · {p.where.split("·")[0].trim() || "Location TBD"}
          </p>
          <p className="muted">
            {p.confirmedOptionId
              ? `${p.goingIds.length} going · hosted by ${nameOf(p.hostId)}`
              : rec
                ? `Recommended time · ${comingTo(rec).length} of ${n} can come`
                : `Best so far · ${statusText(n, ranked(n, p)[0].status, p.hostId === me!.id ? "you (host)" : nameOf(p.hostId))}`}
          </p>
        </div>
      </div>
      <div className="pills">
        {!p.confirmedOptionId && <span className="tag">{left > 0 ? `Voting closes in ${fmtLeft(left)}` : "Voting closed"}</span>}
        <CostTag item={p} />
        {!p.confirmedOptionId && !p.options.some((opt) => opt.resp[me!.id]) && <span className="tag warn">Waiting on your answer</span>}
        {p.hostId === me!.id && hostCalls.length > 0 && <span className="tag warn">A new time needs your answer</span>}
      </div>
      <div className="row gap mt wrap-row">
        {p.confirmedOptionId ? (
          p.goingIds.includes(me!.id) ? (
            <button className="btn btn-primary sm" onClick={() => go("log", { groupId: g.id })}>
              Log it <Icon name="arrow" />
            </button>
          ) : (
            <button
              className="btn btn-primary sm"
              onClick={() => {
                update((s) => joinLate(s, g.id, me!.id));
                toast("You're going");
              }}
            >
              I'll make it anyway
            </button>
          )
        ) : (
          <>
            <button className={`btn ${mine === "yes" ? "btn-secondary" : "btn-primary"} sm`} onClick={mine === "yes" ? undefined : accept}>
              {mine === "yes" ? (
                <>
                  <Icon name="check" /> You're in
                </>
              ) : (
                "I'm in"
              )}
            </button>
            <button className="btn btn-secondary sm" onClick={() => go("group", { groupId: g.id, tab: "votes" })}>
              Answer every time
            </button>
          </>
        )}
        <button className="link ml-auto" onClick={() => go("group", { groupId: g.id, tab: "votes" })}>
          {p.confirmedOptionId ? "Details" : "See votes"} <Icon name="arrow" />
        </button>
      </div>
      {people.length > 0 && (
        <div className="ev-meta">
          <span className="avs">
            {people.slice(0, 5).map((id) => (
              <Avatar key={id} name={nameOf(id)} me={id === me!.id} />
            ))}
          </span>
          <span className="muted">
            {people.length} in · {p.confirmedOptionId ? "confirmed" : `${waiting} waiting`}
          </span>
        </div>
      )}
    </section>
  );
}

function Feed({ g, now }: { g: Group; now: number }) {
  const { me, nameOf } = useStore();
  const items = [...g.feed].reverse().slice(0, 25);
  return (
    <section className="card pad">
      <div className="card-head">
        <div>
          <h2>Group activity</h2>
          <p className="muted">Updates show up here for everyone, live.</p>
        </div>
      </div>
      <div className="feed">
        {items.length ? (
          items.map((f) => (
            <div className={`fitem${now - f.t < 8000 ? " new" : ""}`} key={f.id}>
              <Avatar name={nameOf(f.byId)} me={f.byId === me!.id} />
              <div>
                <p>
                  <b>{nameOf(f.byId)}</b> {feedText(f)}
                </p>
                <span className="muted small">{relTime(f.t, now)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">
            <p>Nothing yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function VotesTab({ g }: { g: Group }) {
  const { me, update, nameOf, toast } = useStore();
  const { go } = useNav();
  const now = useNow();
  const [sheet, setSheet] = useState<"suggest" | "partial" | "confirm" | "handoff" | null>(null);
  const [partialId, setPartialId] = useState<string | null>(null);
  const p = g.plan;

  if (!p)
    return (
      <div className="votes-grid">
        <section className="card pad">
          <div className="card-head">
            <div>
              <h2>No open plans</h2>
              <p className="muted">Post an event and everyone can answer each time.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => go("plan", { groupId: g.id })}>
            <Icon name="plus" /> Post an event
          </button>
        </section>
        <Feed g={g} now={now} />
      </div>
    );

  const n = g.memberIds.length;
  const isHost = p.hostId === me!.id;
  const rows = ranked(n, p);
  const rec = recommended(n, p);
  const need = needOf(n);
  const closed = now >= deadlineOf(p);
  const unansweredHost = needsHost(p);
  const outAll = hostOutAll(p);

  const answer = (o: TimeOption, kind: AnswerKind) => {
    if (kind === "part") {
      setPartialId(o.id);
      setSheet("partial");
      return;
    }
    const result = { value: "noop" as string };
    update((s) => {
      result.value = setAnswer(s, g.id, me!.id, o.id, kind);
    });
    toast(result.value === "cleared" ? "Answer cleared" : `${ANS[kind].label} for ${optLabel(o)}`);
  };

  return (
    <div className="votes-grid">
      <section className="card pad">
        <div className="eyebrow">
          Hosted by {nameOf(p.hostId)}
          {p.hostId !== p.byId ? ` · posted by ${nameOf(p.byId)}` : ""} · {relTime(new Date(p.createdAt).getTime(), now)}
        </div>
        <h2 style={{ fontSize: 28, letterSpacing: "-.035em" }}>{p.title}</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          {p.where}
        </p>
        {p.note && <div className="quote">“{p.note}”</div>}
        <div className="pills">
          <CostTag item={p} />
          {p.price == null && p.est && <span className="tag">Gemini estimate (simulated)</span>}
        </div>
        <Banner
          g={g}
          p={p}
          isHost={isHost}
          closed={closed}
          outAll={outAll}
          now={now}
          unansweredHost={unansweredHost}
          onConfirm={() => setSheet("confirm")}
          onHandoff={() => setSheet("handoff")}
          onExtend={() => {
            update((s) => extendVoting(s, g.id, me!.id));
            toast("Voting extended by 12 hours");
          }}
        />

        {p.confirmedOptionId ? (
          <Confirmed g={g} p={p} onSuggest={() => setSheet("suggest")} onHandoff={() => setSheet("handoff")} />
        ) : (
          <>
            <div className="mini-h">Answer every time that could work</div>
            {rows.map((row) => (
              <OptionCard
                key={row.option.id}
                g={g}
                p={p}
                row={row}
                recommendedId={rec?.id}
                onAnswer={(kind) => answer(row.option, kind)}
                onPick={() => {
                  update((s) => setHostPick(s, g.id, me!.id, row.option.id));
                  toast("Your pick wins any ties");
                }}
              />
            ))}
            <div className="row gap mt wrap-row">
              <button className="btn btn-secondary sm" onClick={() => setSheet("suggest")}>
                <Icon name="clock" /> Suggest another time
              </button>
              <button
                className="btn btn-secondary sm"
                onClick={() => {
                  update((s) => declineAll(s, g.id, me!.id));
                  toast(isHost ? "Marked as No. You can hand off hosting." : "Marked as No for every time");
                }}
              >
                Can't make any
              </button>
              {isHost && (
                <button className="btn btn-primary sm ml-auto" disabled={!rec} onClick={() => setSheet("confirm")}>
                  Confirm…
                </button>
              )}
            </div>
            {isHost && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={p.auto}
                  onChange={(e) => {
                    const on = e.target.checked;
                    update((s) => setAuto(s, g.id, me!.id, on));
                    toast(on ? "Auto-confirm is on" : "Auto-confirm is off");
                  }}
                />
                <span>Auto-confirm the recommended time when voting closes</span>
              </label>
            )}
            <p className="hint-line">
              <b>How a time wins:</b> the host has to be free, at least {need} of {n} have to say Yes or Partly, then the highest score wins (Yes 1 · Partly ½ · If needed ¼). Ties go to the host's pick, then the earlier date.
            </p>
            <div className="mini-h">Hasn't answered ({waitingIds(g.memberIds, p).length})</div>
            <p className="muted small">{waitingIds(g.memberIds, p).map(nameOf).join(", ") || "Everyone has answered"}</p>
          </>
        )}
      </section>
      <Feed g={g} now={now} />

      {sheet === "suggest" && <TimeSheet g={g} p={p} onClose={() => setSheet(null)} />}
      {sheet === "partial" && partialId && <PartialSheet g={g} p={p} optionId={partialId} onClose={() => setSheet(null)} />}
      {sheet === "confirm" && <ConfirmSheet g={g} p={p} onClose={() => setSheet(null)} />}
      {sheet === "handoff" && <HandoffSheet g={g} p={p} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Banner({
  g,
  p,
  isHost,
  closed,
  outAll,
  unansweredHost,
  now,
  onConfirm,
  onHandoff,
  onExtend,
}: {
  g: Group;
  p: Plan;
  isHost: boolean;
  closed: boolean;
  outAll: boolean;
  unansweredHost: TimeOption[];
  now: number;
  onConfirm: () => void;
  onHandoff: () => void;
  onExtend: () => void;
}) {
  const { nameOf } = useStore();
  const rec = recommended(g.memberIds.length, p);
  const conf = p.options.find((o) => o.id === p.confirmedOptionId);
  if (conf && p.start) {
    return (
      <div className="banner">
        <Icon name="check" />
        <span>
          Confirmed for <b>{fmtD(conf.date, { weekday: "long", month: "short", day: "numeric" })} · {fmtT(p.start)}</b>. {p.goingIds.length} going.
        </span>
      </div>
    );
  }
  if (outAll) {
    return isHost ? (
      <div className="banner bad">
        <Icon name="x" />
        <span>You can't make any of these times. Hand off hosting or cancel.</span>
        <button className="btn btn-primary sm ml-auto" onClick={onHandoff}>
          Hand off
        </button>
      </div>
    ) : (
      <div className="banner warn">
        <Icon name="clock" />
        <span>{nameOf(p.hostId)} can't make any of these times yet.</span>
      </div>
    );
  }
  if (isHost && unansweredHost.length > 0) {
    return (
      <div className="banner warn">
        <Icon name="clock" />
        <span>
          Answer {unansweredHost.map((o) => `${nameOf(o.byId)}'s time (${optLabel(o)})`).join(" and ")}. A time can't win until you answer it.
        </span>
      </div>
    );
  }
  if (!closed) {
    return (
      <div className="banner neutral">
        <Icon name="clock" />
        <span>
          Voting closes in <b>{fmtLeft(deadlineOf(p) - now)}</b>
          {p.auto ? ". The top time confirms itself then." : ""}.
        </span>
        {isHost && (
          <button className="link ml-auto" onClick={onExtend}>
            +12h
          </button>
        )}
      </div>
    );
  }
  if (rec) {
    return isHost ? (
      <div className="banner">
        <Icon name="check" />
        <span>
          Voting closed. <b>{optLabel(rec)}</b> is ready to confirm.
        </span>
        <button className="btn btn-primary sm ml-auto" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : (
      <div className="banner warn">
        <Icon name="clock" />
        <span>Voting closed. Waiting on {nameOf(p.hostId)} to confirm.</span>
      </div>
    );
  }
  return (
    <div className="banner warn">
      <Icon name="clock" />
      <span>Voting closed and no time has enough people yet.</span>
      {isHost && (
        <button className="btn btn-secondary sm ml-auto" onClick={onExtend}>
          Extend 12h
        </button>
      )}
    </div>
  );
}

function OptionCard({
  g,
  p,
  row,
  recommendedId,
  onAnswer,
  onPick,
}: {
  g: Group;
  p: Plan;
  row: ReturnType<typeof ranked>[number];
  recommendedId?: string;
  onAnswer: (kind: AnswerKind) => void;
  onPick: () => void;
}) {
  const { me, nameOf } = useStore();
  const o = row.option;
  const d = parseD(o.date);
  const mine = o.resp[me!.id]?.a;
  const isRec = recommendedId === o.id;
  const shift = isRec ? adjusted(o) : null;
  const pick = hostPickId(p) === o.id;
  const isHost = p.hostId === me!.id;
  const hostLabel = isHost ? "you (host)" : nameOf(p.hostId);
  const groups: AnswerKind[] = ["yes", "part", "maybe", "no"];
  const unanswered = g.memberIds.filter((id) => !o.resp[id]);

  return (
    <div className={`opt${isRec ? " lead" : ""}`}>
      <div className="opt-top">
        <div className="dtile">
          <span>{MON[d.getMonth()]}</span>
          <b>{d.getDate()}</b>
        </div>
        <div className="opt-b">
          <b>
            {fmtD(o.date, { weekday: "long" })} · {fmtT(o.time)}
          </b>
          <span className="muted">Suggested by {nameOf(o.byId)}</span>
          <div className="pills">
            {isRec && <span className="tag ok">Recommended</span>}
            <span className={`tag${row.status.code === "host" || row.status.code === "hostno" ? " h" : ""}`}>{statusText(g.memberIds.length, row.status, hostLabel)}</span>
            {isHost ? (
              <button className={`star-pick${pick ? " on" : ""}`} onClick={onPick}>
                ★ {pick ? "Your pick" : "Make my pick"}
              </button>
            ) : (
              pick && <span className="tag">Host's pick</span>
            )}
          </div>
        </div>
        <div className="opt-score">
          <b>{fmtScore(row.score)}</b>
          <span>score</span>
        </div>
      </div>
      <div className="vbar">
        <i style={{ width: `${(row.score / g.memberIds.length) * 100}%` }} />
      </div>
      <div className="ans-row">
        {groups.map((kind) => {
          const people = Object.keys(o.resp).filter((id) => o.resp[id].a === kind);
          if (!people.length) return null;
          return (
            <span className={`ans-grp a-${kind}`} key={kind}>
              <b>{ANS[kind].label}</b>
              <span className="avs">
                {people.map((id) => (
                  <Avatar key={id} name={nameOf(id)} me={id === me!.id} />
                ))}
              </span>
            </span>
          );
        })}
        {unanswered.length > 0 && (
          <span className="ans-grp a-none">
            <b>No answer</b>
            <span className="avs">
              {unanswered.map((id) => (
                <Avatar key={id} name={nameOf(id)} me={id === me!.id} />
              ))}
            </span>
          </span>
        )}
      </div>
      {Object.keys(o.resp)
        .filter((id) => o.resp[id].a === "part")
        .map((id) => (
          <p className="late" key={id}>
            {nameOf(id)}: {lateNote(o.resp[id])}
          </p>
        ))}
      {shift && (
        <div className="adj">
          <Icon name="clock" />
          <span>
            Start at <b>{fmtT(shift.start)}</b>
            {shift.end ? ` and wrap by ${fmtT(shift.end)}` : ""} so everyone who's coming overlaps.
          </span>
        </div>
      )}
      <div className="ans-pick">
        <span className="muted small">{isHost && !mine ? <b className="warn-ink">Host, answer this:</b> : "Your answer:"}</span>
        {(Object.keys(ANS) as AnswerKind[]).map((kind) => (
          <button key={kind} className={`ans a-${kind}${mine === kind ? " on" : ""}`} onClick={() => onAnswer(kind)}>
            {ANS[kind].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Confirmed({ g, p, onSuggest, onHandoff }: { g: Group; p: Plan; onSuggest: () => void; onHandoff: () => void }) {
  const { me, update, nameOf, toast } = useStore();
  const { go } = useNav();
  const conf = p.options.find((o) => o.id === p.confirmedOptionId);
  const notGoing = g.memberIds.filter((id) => !p.goingIds.includes(id));
  const mine = p.requests.filter((r) => r.byId === me!.id);
  const isHost = p.hostId === me!.id;

  return (
    <>
      <div className="mini-h">Going ({p.goingIds.length})</div>
      <div className="crew">
        {p.goingIds.map((id) => (
          <div className="crew-row" key={id}>
            <Avatar name={nameOf(id)} me={id === me!.id} />
            <span className="nm">
              {nameOf(id)}
              {id === p.hostId && <span className="tag">Host</span>}
            </span>
            <span className="muted">{(conf && lateNote(conf.resp[id])) || (conf?.resp[id] ? "" : "joined after")}</span>
          </div>
        ))}
      </div>
      {notGoing.length > 0 && (
        <>
          <div className="mini-h">Not going ({notGoing.length})</div>
          <p className="muted small">{notGoing.map(nameOf).join(", ")}</p>
        </>
      )}
      {isHost && p.requests.length > 0 && (
        <>
          <div className="mini-h">Change requests</div>
          {p.requests.map((r) => (
            <div className="req" key={r.id}>
              <Avatar name={nameOf(r.byId)} me={r.byId === me!.id} />
              <span className="t">
                <b>{nameOf(r.byId)}</b> asked for {optLabel(r)}
              </span>
              <button
                className="btn btn-primary sm"
                onClick={() => {
                  update((s) => acceptRequest(s, g.id, me!.id, r.id, uid()));
                  toast("Voting reopened with the new time");
                }}
              >
                Add and reopen
              </button>
              <button
                className="btn btn-secondary sm"
                onClick={() => {
                  update((s) => declineRequest(s, g.id, me!.id, r.id));
                  toast("Kept the confirmed time");
                }}
              >
                Keep current
              </button>
            </div>
          ))}
        </>
      )}
      {mine.length > 0 && (
        <p className="hint-line">
          Your request for {optLabel(mine[mine.length - 1])} is waiting on {nameOf(p.hostId)}.
        </p>
      )}
      <div className="row gap mt wrap-row">
        {p.goingIds.includes(me!.id) ? (
          <>
            <button className="btn btn-primary sm" onClick={() => go("log", { groupId: g.id })}>
              Log it <Icon name="arrow" />
            </button>
            <button
              className="btn btn-secondary sm"
              onClick={() => {
                if (isHost) return onHandoff();
                const result = { value: "noop" as string };
                update((s) => {
                  result.value = dropOut(s, g.id, me!.id);
                });
                toast(result.value === "reopened" ? "Not enough people now, so voting reopened" : "Marked as not going");
              }}
            >
              Can't make it anymore
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary sm"
            onClick={() => {
              update((s) => joinLate(s, g.id, me!.id));
              toast("You're going");
            }}
          >
            I'll make it anyway
          </button>
        )}
        {isHost ? (
          <button
            className="btn btn-secondary sm"
            onClick={() => {
              update((s) => reopenVoting(s, g.id, me!.id));
              toast("Voting is open again");
            }}
          >
            Change the time
          </button>
        ) : (
          <button className="btn btn-secondary sm" onClick={onSuggest}>
            <Icon name="clock" /> Request a change
          </button>
        )}
      </div>
      <p className="hint-line">Only the host can change a confirmed time. If fewer than {needOf(g.memberIds.length)} people are going, voting reopens on its own.</p>
    </>
  );
}

function TimeSheet({ g, p, onClose }: { g: Group; p: Plan; onClose: () => void }) {
  const { me, update, nameOf, toast } = useStore();
  const lead = activeOption(g.memberIds.length, p);
  const [date, setDate] = useState(lead?.date ?? "");
  const [time, setTime] = useState(p.confirmedOptionId ? p.start || lead?.time || "18:00" : lead?.time || "18:00");
  const [bad, setBad] = useState(false);
  const asking = !!p.confirmedOptionId;
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>{asking ? "Request a change" : "Suggest a time"}</h2>
        <p className="meta">
          {asking
            ? `${nameOf(p.hostId)} decides whether to add it and reopen voting.`
            : `It's added as a new option. ${p.hostId === me!.id ? "Everyone" : `${nameOf(p.hostId)} answers it first, then everyone`} can weigh in.`}
        </p>
      </div>
      <div className="f2">
        <label className="f">
          <span>Date</span>
          <input type="date" className={`field${bad ? " err" : ""}`} value={date} onChange={(e) => (setDate(e.target.value), setBad(false))} />
        </label>
        <label className="f">
          <span>Time</span>
          <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <button
        className="btn btn-primary block"
        onClick={() => {
          if (!date) return setBad(true);
          const result = { value: "noop" as string };
          update((s) => {
            result.value = addTime(s, g.id, me!.id, date, time || "18:00", uid());
          });
          const label = optLabel({ date, time: time || "18:00" });
          toast(result.value === "request" ? `Sent to ${nameOf(p.hostId)}` : result.value === "dup" ? `Said Yes to ${label}` : `Suggested ${label}`);
          onClose();
        }}
      >
        {asking ? "Send request" : "Add this time"} <Icon name="arrow" />
      </button>
    </Sheet>
  );
}

function PartialSheet({ g, p, optionId, onClose }: { g: Group; p: Plan; optionId: string; onClose: () => void }) {
  const { me, update, toast } = useStore();
  const o = p.options.find((x) => x.id === optionId);
  const prev = o?.resp[me!.id];
  const [from, setFrom] = useState(prev?.from || (o ? fromPlusHour(o.time) : ""));
  const [until, setUntil] = useState(prev?.until || "");
  const [err, setErr] = useState("");
  if (!o) return null;
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>Partly free</h2>
        <p className="meta">{optLabel(o)}. Say when you can be there, and leave a box empty if it doesn't matter.</p>
      </div>
      <div className="f2">
        <label className="f">
          <span>Can get there by</span>
          <input type="time" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="f">
          <span>Have to leave by</span>
          <input type="time" className={`field${err ? " err" : ""}`} value={until} onChange={(e) => (setUntil(e.target.value), setErr(""))} />
        </label>
      </div>
      <p className="err-line">{err}</p>
      <button
        className="btn btn-primary block"
        onClick={() => {
          if (from && until && until <= from) return setErr("Your leave time has to be after your arrival time.");
          update((s) => setAnswer(s, g.id, me!.id, o.id, "part", { ...(from ? { from } : {}), ...(until ? { until } : {}) }));
          toast(`Partly for ${optLabel(o)}`);
          onClose();
        }}
      >
        Save answer
      </button>
    </Sheet>
  );
}

function fromPlusHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ConfirmSheet({ g, p, onClose }: { g: Group; p: Plan; onClose: () => void }) {
  const { me, update, toast } = useStore();
  const n = g.memberIds.length;
  const ok = ranked(n, p).filter((r) => r.status.ok);
  const [pick, setPick] = useState(ok[0]?.option.id ?? "");
  const chosen = ok.find((r) => r.option.id === pick) ?? ok[0];
  const shift = chosen ? adjusted(chosen.option) : null;
  const [useShift, setUseShift] = useState(true);
  if (!ok.length || !chosen) return null;
  const rec = ok[0].option;
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <div className="eyebrow" style={{ margin: 0 }}>
          {g.name}
        </div>
        <h2>Confirm {p.title}</h2>
        <p className="meta">Everyone who said Yes or Partly to the time you pick is marked as going.</p>
      </div>
      <div className="picker">
        {ok.map((r) => (
          <button key={r.option.id} className={`pick-row${r.option.id === chosen.option.id ? " on" : ""}`} onClick={() => setPick(r.option.id)}>
            <span className="t">
              <b>
                {optLabel(r.option)} {r.option.id === rec.id && <span className="tag ok">Recommended</span>}
              </b>
              <span className="muted">
                {comingTo(r.option).length} of {n} can come · score {fmtScore(r.score)} · {turnoutPoints(comingTo(r.option).length, n)} turnout points
              </span>
            </span>
          </button>
        ))}
      </div>
      {chosen.option.id !== rec.id && (
        <div className="banner warn">
          <Icon name="clock" />
          <span>
            {optLabel(rec)} gets {comingTo(rec).length} of {n} ({turnoutPoints(comingTo(rec).length, n)} turnout points). Your pick gets {comingTo(chosen.option).length} of {n} ({turnoutPoints(comingTo(chosen.option).length, n)}).
          </span>
        </div>
      )}
      {shift && (
        <label className="check-row">
          <input type="checkbox" checked={useShift} onChange={(e) => setUseShift(e.target.checked)} />
          <span>
            Start at {fmtT(shift.start)} instead of {fmtT(chosen.option.time)} so everyone overlaps
          </span>
        </label>
      )}
      <button
        className="btn btn-primary block"
        onClick={() => {
          const start = shift && useShift ? shift.start : chosen.option.time;
          const did = { ok: false };
          update((s) => {
            did.ok = confirm(s, g.id, me!.id, chosen.option.id, start);
          });
          if (!did.ok) return toast("That time doesn't have enough people yet");
          toast(`Confirmed ${optLabel({ date: chosen.option.date, time: start })}`);
          onClose();
        }}
      >
        Confirm this time <Icon name="check" />
      </button>
    </Sheet>
  );
}

function HandoffSheet({ g, p, onClose }: { g: Group; p: Plan; onClose: () => void }) {
  const { me, update, nameOf, toast } = useStore();
  const choices = g.memberIds
    .filter((id) => id !== p.hostId)
    .map((id) => ({
      id,
      n: p.confirmedOptionId ? Number(p.goingIds.includes(id)) : p.options.filter((o) => isFree(o.resp[id]?.a)).length,
    }))
    .sort((a, b) => b.n - a.n);

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>Hand off hosting</h2>
        <p className="meta">The new host answers new times and confirms. People who are free the most are listed first.</p>
      </div>
      <div className="picker">
        {choices.map((c) => (
          <button
            key={c.id}
            className="pick-row"
            onClick={() => {
              const result = { value: "noop" as string };
              update((s) => {
                result.value = handoff(s, g.id, me!.id, c.id, nameOf(c.id));
              });
              toast(`${nameOf(c.id)} is hosting now${result.value === "reopened" ? " · voting reopened" : ""}`);
              onClose();
            }}
          >
            <Avatar name={nameOf(c.id)} />
            <span className="t">
              <b>{nameOf(c.id)}</b>
              <span className="muted">
                {p.confirmedOptionId ? (c.n ? "Going" : "Not going") : `Free for ${c.n} of ${p.options.length} ${p.options.length === 1 ? "time" : "times"}`}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        className="btn btn-secondary block mt"
        onClick={() => {
          update((s) => cancelPlan(s, g.id, me!.id));
          toast("Event canceled");
          onClose();
        }}
      >
        Cancel the event instead
      </button>
    </Sheet>
  );
}
