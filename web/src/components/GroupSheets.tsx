import { useEffect, useMemo, useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { Sheet } from "./Sheet";
import { Avatar, Icon } from "./Icons";
import { Stars } from "./Stars";
import { CATS, MAX_GROUP, MIN_GROUP } from "../lib/scoring";
import { fmtD } from "../lib/dates";
import { addComment, avgRating, costOf, rateLog } from "../lib/budget";
import { relTime } from "../lib/plans";
import type { ActivityLog } from "../lib/types";

/** Create a group by searching your friends list. */
export function NewGroupSheet({ onClose }: { onClose: () => void }) {
  const { me, state, update, toast } = useStore();
  const { go } = useNav();
  const [name, setName] = useState("");
  const [hood, setHood] = useState(me!.region.split(",")[0]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [school, setSchool] = useState(!!me!.school);
  const [err, setErr] = useState("");

  const friends = useMemo(
    () => state.users.filter((u) => me!.friendIds.includes(u.id)),
    [state.users, me],
  );
  const shown = friends.filter((f) => `${f.displayName} ${f.username}`.toLowerCase().includes(q.toLowerCase().replace(/^@/, "")));
  const size = picked.length + 1;

  const create = () => {
    if (!name.trim()) return setErr("Name your group");
    if (size < MIN_GROUP || size > MAX_GROUP) return setErr(`Groups have ${MIN_GROUP}–${MAX_GROUP} people including you`);
    const id = uid();
    update((s) => {
      s.groups.push({
        id,
        name: name.trim(),
        region: me!.region,
        hood: hood.trim() || me!.region.split(",")[0],
        school: school ? me!.school : undefined,
        createdAt: new Date().toISOString().slice(0, 10),
        memberIds: [me!.id, ...picked],
        plan: null,
        pastPlans: [],
        feed: [],
      });
    });
    onClose();
    go("group", { groupId: id });
    toast(`${name.trim()} is planted${size === 2 ? " · on the Duos board" : ""}`);
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>Start a new group</h2>
        <p className="meta">Plant a tree. Grow it together. 3–8 people, or 2 for the Duos board.</p>
      </div>
      <label className="f">
        <span>Group name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Night Owls" autoFocus />
      </label>
      <label className="f">
        <span>Neighborhood</span>
        <input className="field" value={hood} onChange={(e) => setHood(e.target.value)} />
      </label>
      <div className="f">
        <span>
          Friends <em>{size} of {MAX_GROUP} · search your friends list</em>
        </span>
        <input className="field" placeholder="Search by name or @username" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        {friends.length === 0 ? (
          <p className="hint">No friends yet. Add friends by username on your profile first.</p>
        ) : (
          <div className="picker">
            {shown.map((f) => {
              const on = picked.includes(f.id);
              return (
                <button
                  key={f.id}
                  className={`chip${on ? " on" : ""}`}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : size >= MAX_GROUP ? picked : [...picked, f.id])}
                >
                  {on && <Icon name="check" />}
                  {f.displayName} <span className="muted small">@{f.username}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {me!.school && (
        <label className="row gap" style={{ fontSize: 14, margin: "4px 0 20px" }}>
          <input type="checkbox" checked={school} onChange={(e) => setSchool(e.target.checked)} /> Count us on the {me!.school} board
        </label>
      )}
      {err && <p className="err-text" style={{ marginBottom: 12 }}>{err}</p>}
      <button className="btn btn-primary block" onClick={create}>
        Plant the tree <Icon name="arrow" />
      </button>
    </Sheet>
  );
}

/** Add friends to an existing group (up to 8 members). */
export function InviteSheet({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { me, state, update, toast } = useStore();
  const g = state.groups.find((x) => x.id === groupId)!;
  const options = state.users.filter((u) => me!.friendIds.includes(u.id) && !g.memberIds.includes(u.id));
  const full = g.memberIds.length >= MAX_GROUP;
  const add = (id: string, name: string) => {
    update((s) => {
      const gg = s.groups.find((x) => x.id === groupId)!;
      if (gg.memberIds.length < MAX_GROUP && !gg.memberIds.includes(id)) gg.memberIds.push(id);
    });
    toast(`${name} joined ${g.name}`);
  };
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <h2>Invite friends</h2>
        <p className="meta">
          {g.name} · {g.memberIds.length} of {MAX_GROUP} spots filled
        </p>
      </div>
      {full ? (
        <p className="muted">This group is full.</p>
      ) : options.length === 0 ? (
        <p className="muted">All your friends are already here. Add more friends by username on your profile.</p>
      ) : (
        <div className="crew">
          {options.map((u) => (
            <div className="crew-row" key={u.id}>
              <Avatar name={u.displayName} />
              <span className="nm">
                {u.displayName} <span className="muted">@{u.username}</span>
              </span>
              <button className="btn btn-soft sm" onClick={() => add(u.id, u.displayName)}>
                <Icon name="plus" /> Add
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** Full view of one logged activity. */
export function LogSheet({ logs, index, onClose, onNav }: { logs: ActivityLog[]; index: number; onClose: () => void; onNav: (i: number) => void }) {
  const { state, nameOf, me, update, toast } = useStore();
  const [draft, setDraft] = useState("");
  const l = logs[index];
  useEffect(() => setDraft(""), [index]);
  if (!l) return null;
  const g = state.groups.find((x) => x.id === l.groupId);
  const p = l.points;
  const went = !!me && l.attendeeIds.includes(me.id);
  const mine = me ? l.ratings[me.id] : undefined;
  const avg = avgRating(l.ratings);
  const cost = costOf(l);
  const rate = (n: number) => {
    if (!me) return;
    update((s) => rateLog(s, l.id, me.id, n));
    toast(`Rated ${n}★`);
  };
  const post = () => {
    const text = draft.trim();
    if (!text || !me) return;
    update((s) => addComment(s, l.id, me.id, text, uid()));
    setDraft("");
    toast("Comment posted");
  };
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <span className="ico" style={{ fontSize: 28 }}>
          {l.emoji}
        </span>
        <div className="eyebrow" style={{ margin: 0 }}>
          Memory {index + 1} of {logs.length} · {CATS[l.cat].label}
        </div>
        <h2>{l.title}</h2>
        <p className="meta">{fmtD(l.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
        {l.labels.length > 0 && (
          <div className="labels">
            {l.labels.map((t) => (
              <span className="label" key={t}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      {l.description && <div className="quote">“{l.description}”</div>}
      <div className="rate-row">
        <div>
          <div className="eyebrow" style={{ margin: "0 0 6px" }}>
            Group rating
          </div>
          <div className="big-rate">
            {avg != null ? avg.toFixed(1) : "–"}
            <span>★</span>
          </div>
          <p className="muted small" style={{ marginTop: 4 }}>
            {Object.keys(l.ratings).length} of {l.attendeeIds.length} who went rated it
          </p>
        </div>
        <div className="my-rate">
          <div className="eyebrow" style={{ margin: "0 0 6px" }}>
            {went ? (mine ? "Your rating" : "Rate it") : "Only people who went can rate"}
          </div>
          <Stars value={mine ?? 0} onRate={went ? rate : undefined} readOnly={!went} />
        </div>
      </div>
      {l.media.length > 0 && (
        <div className="sheet-media">
          {l.media.map((m) => (m.kind === "image" ? <img key={m.id} src={m.url} alt="" /> : <video key={m.id} src={m.url} controls />))}
        </div>
      )}
      <div className="kv">
        <div>
          <span>Where</span>
          <span className="names">{l.where || "—"}</span>
        </div>
        <div>
          <span>Who made it out</span>
          <span className="avs">
            {l.attendeeIds.map((id) => (
              <Avatar key={id} name={nameOf(id)} me={id === me?.id} />
            ))}
          </span>
        </div>
        <div>
          <span />
          <span className="names muted">{l.attendeeIds.map(nameOf).join(", ")}</span>
        </div>
        {cost && (
          <div>
            <span>Cost per person</span>
            <span className="names">
              {cost.txt}
              {cost.manual ? "" : <span className="muted"> (estimate)</span>}
            </span>
          </div>
        )}
        <div>
          <span>Logged by</span>
          <span className="names">{nameOf(l.authorId)}</span>
        </div>
        <div>
          <span>Points</span>
          <span className="names">
            <b>+{p.total}</b>{" "}
            <span className="muted small">
              niche {p.niche} · turnout {p.turnout}
              {p.speed ? ` · speed ${p.speed}` : ""}
              {p.krillion ? ` · Krillion ${p.krillion}` : ""}
              {p.holiday ? ` · ${p.holidayName} ${p.holiday}` : ""}
            </span>
          </span>
        </div>
        <div>
          <span>Group</span>
          <span className="names">{g?.name}</span>
        </div>
      </div>
      <div className="mini-h">Comments ({l.comments.length})</div>
      <div className="comments">
        {l.comments.length ? (
          l.comments.map((c) => (
            <div className="fitem" key={c.id}>
              <Avatar name={nameOf(c.byId)} me={c.byId === me?.id} />
              <div>
                <p>
                  <b>{nameOf(c.byId)}</b> {c.text}
                </p>
                <span className="muted small">{relTime(c.t)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted small">No comments yet. Start the thread.</p>
        )}
      </div>
      <div className="cm-row">
        <input className="field" placeholder="Add a comment" maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} />
        <button className="btn btn-primary" onClick={post}>
          Post
        </button>
      </div>
      <div className="sheet-nav">
        <button className="btn btn-secondary sm" disabled={index === 0} onClick={() => onNav(index - 1)}>
          <Icon name="chevL" /> Older
        </button>
        <button className="btn btn-secondary sm" disabled={index === logs.length - 1} onClick={() => onNav(index + 1)}>
          Newer <Icon name="chevR" />
        </button>
      </div>
    </Sheet>
  );
}
