import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { CatIcon, Icon } from "../components/Icons";
import { MAX_FRUIT } from "../components/Tree";
import { CATS, normLabel, scoreLog } from "../lib/scoring";
import { todayISO } from "../lib/dates";
import { groupInfo } from "../lib/groupInfo";
import type { ActivityLog, Cat, Media } from "../lib/types";

const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

/** Downscale photos so they fit in demo storage. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}
const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function LogPage() {
  const { me, state, myGroups, update, toast } = useStore();
  const { route, go } = useNav();
  const [gid, setGid] = useState(route.groupId ?? myGroups[0]?.id);
  const g = myGroups.find((x) => x.id === gid) ?? myGroups[0];
  const [title, setTitle] = useState(g?.plan?.confirmedAt ? g.plan.title : "");
  const [where, setWhere] = useState(g?.plan?.confirmedAt ? g.plan.where : "");
  const [date, setDate] = useState(todayISO());
  const [who, setWho] = useState<string[]>(g ? (g.plan?.confirmedAt ? g.plan.inIds : g.memberIds) : []);
  const [cat, setCat] = useState<Cat>("food");
  const [emoji, setEmoji] = useState(CATS.food.emoji);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [linkPlan, setLinkPlan] = useState(!!g?.plan?.confirmedAt);
  const [bad, setBad] = useState(false);
  const [shown, setShown] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = linkPlan ? (g?.plan ?? undefined) : undefined;
  const pts = useMemo(
    () => (g ? scoreLog({ cat, labels, date: date || todayISO(), attendeeIds: who }, g.memberIds.length, state.logs, plan) : null),
    [g, cat, labels, date, who, state.logs, plan],
  );

  // Count-up animation for the big number, as in the original design.
  useEffect(() => {
    if (!pts) return;
    const from = shown;
    const to = pts.total;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only when the total changes
  }, [pts?.total]);

  if (!g || !pts) return <p className="muted">Create a group first.</p>;

  const switchGroup = (id: string) => {
    const ng = myGroups.find((x) => x.id === id)!;
    setGid(id);
    setWho(ng.memberIds);
    setLinkPlan(!!ng.plan?.confirmedAt);
  };

  const addLabel = () => {
    const l = normLabel(labelDraft);
    if (l && !labels.includes(l)) setLabels([...labels, l]);
    setLabelDraft("");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const out: Media[] = [];
    for (const f of [...files]) {
      if (f.type.startsWith("image/")) out.push({ id: uid(), kind: "image", url: await readImage(f) });
      else if (f.type.startsWith("video/")) {
        if (f.size > MAX_VIDEO_BYTES) toast(`${f.name} is over 4 MB, too big for the demo`);
        else out.push({ id: uid(), kind: "video", url: await readDataUrl(f) });
      }
    }
    setMedia((m) => [...m, ...out]);
  };

  const save = () => {
    if (!title.trim()) return setBad(true);
    if (!who.length) return toast("Pick at least one person who made it out");
    const log: ActivityLog = {
      id: uid(),
      groupId: g.id,
      authorId: me!.id,
      title: title.trim(),
      description: desc.trim(),
      cat,
      emoji: emoji.trim() || CATS[cat].emoji,
      labels,
      date: date || todayISO(),
      where: where.trim(),
      attendeeIds: g.memberIds.filter((m) => who.includes(m)),
      media,
      eventId: plan?.id,
      points: pts,
    };
    const ok = update((s) => {
      s.logs.push(log);
      const gg = s.groups.find((x) => x.id === g.id)!;
      if (plan && gg.plan?.id === plan.id) {
        gg.pastPlans.push(gg.plan);
        gg.plan = null;
      }
    });
    if (!ok) return toast("Storage is full. Try fewer or smaller photos/videos.");
    const after = groupInfo({ ...state, logs: [...state.logs, log] }, g).logs.findIndex((l) => l.id === log.id);
    go("group", { groupId: g.id, grow: after < MAX_FRUIT ? after : null });
    toast(`+${pts.total} pts${pts.krillion ? " · Krillion! First in the app this month" : ""} · a new branch grew`);
  };

  const row = (label: string, v: number, extra?: string) => (
    <div>
      <span>
        {label} {extra && <span className="muted">({extra})</span>}
      </span>
      <b>+{v}</b>
    </div>
  );

  return (
    <>
      <button className="back" onClick={() => go("group", { groupId: g.id })}>
        <Icon name="chevL" /> Back to {g.name}
      </button>
      <div className="page-head">
        <div>
          <h1>One for the memory tree.</h1>
          <p className="sub">Log a real outing, earn your points, and watch your group grow.</p>
        </div>
      </div>
      <div className="grid-side">
        <section className="card pad-lg form">
          <h2>What did you get up to?</h2>
          {g.plan && (
            <label className="row gap note-line" style={{ marginTop: 0, marginBottom: 18 }}>
              <input
                type="checkbox"
                checked={linkPlan}
                onChange={(e) => {
                  setLinkPlan(e.target.checked);
                  if (e.target.checked) {
                    setTitle(g.plan!.title);
                    setWhere(g.plan!.where);
                    setWho(g.plan!.inIds.length ? g.plan!.inIds : g.memberIds);
                  }
                }}
              />
              This is our plan: <b>{g.plan.title}</b> {g.plan.confirmedAt ? "(locked in, earns speed points)" : "(not locked in yet)"}
            </label>
          )}
          <label className="f">
            <span>Activity</span>
            <input className={`field${bad ? " err" : ""}`} value={title} onChange={(e) => (setTitle(e.target.value), setBad(false))} placeholder="A different view of the Charles" />
          </label>
          <label className="f">
            <span>Location</span>
            <input className="field" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Charles River Canoe & Kayak · Allston" />
          </label>
          <div className="f2">
            <label className="f">
              <span>When?</span>
              <input type="date" className="field" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="f">
              <span>Group</span>
              <select className="field" value={g.id} onChange={(e) => switchGroup(e.target.value)}>
                {myGroups.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.memberIds.length} friends
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="f">
            <span>
              Who made it out? <em>{who.length} of {g.memberIds.length}</em>
            </span>
            <div className="chips">
              {g.memberIds.map((m) => {
                const on = who.includes(m);
                const u = state.users.find((x) => x.id === m);
                return (
                  <button key={m} className={`chip${on ? " on" : ""}`} onClick={() => setWho(on ? who.filter((x) => x !== m) : [...who, m])}>
                    {on && <Icon name="check" />}
                    {m === me!.id ? "You" : u?.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="f">
            <span>Pick a memory for your tree</span>
            <div className="cats">
              {(Object.keys(CATS) as Cat[]).map((k) => (
                <button
                  key={k}
                  className={`cat${k === cat ? " on" : ""}`}
                  onClick={() => {
                    setCat(k);
                    setEmoji(CATS[k].emoji);
                  }}
                >
                  <CatIcon cat={k} />
                  {CATS[k].label}
                  <span className="bonus">niche +{Math.round(CATS[k].niche * 100)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="f">
            <span>
              Labels <em>add your own, e.g. #restaurant · #activity</em>
            </span>
            <div className="labels">
              {labels.map((l) => (
                <span className="label" key={l}>
                  #{l}
                  <button aria-label={`Remove ${l}`} onClick={() => setLabels(labels.filter((x) => x !== l))}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="label-input">
              <input
                className="field"
                placeholder="#label"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addLabel();
                  }
                }}
              />
              <button className="btn btn-soft sm" onClick={addLabel}>
                <Icon name="plus" /> Add
              </button>
              <input className="field emoji-field" aria-label="Fruit emoji" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} title="Fruit emoji on your tree" />
            </div>
          </div>
          <label className="f">
            <span>
              Description <em>optional</em>
            </span>
            <textarea className="field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Paddled out past the Weeks Bridge…" />
          </label>
          <div className="f" style={{ margin: 0 }}>
            <span>
              Photos & videos <em>optional, videos up to 4 MB</em>
            </span>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
            <button className="drop" style={{ width: "100%", background: "none" }} onClick={() => fileRef.current?.click()}>
              <Icon name="image" /> Add photos or videos
            </button>
            {media.length > 0 && (
              <div className="media-grid">
                {media.map((m) => (
                  <div className="m" key={m.id}>
                    {m.kind === "image" ? <img src={m.url} alt="" /> : <video src={m.url} muted />}
                    <button aria-label="Remove" onClick={() => setMedia(media.filter((x) => x.id !== m.id))}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <aside className="stack">
          <section className="card pad">
            <div className="eyebrow">A little out of the ordinary</div>
            <h3 style={{ fontSize: 24, letterSpacing: "-.035em", fontWeight: 700 }}>Worth getting out for.</h3>
            <div className="big-pts">{shown}</div>
            <p className="muted small">points for this log</p>
            <div className="breakdown">
              {row("Nicheness", pts.niche, labels.length ? "category or rarest label" : CATS[cat].label)}
              {row("Group turnout", pts.turnout, `${who.length} of ${g.memberIds.length}`)}
              {row("Finalization speed", pts.speed, plan ? (plan.confirmedAt ? "linked plan" : "plan not locked in") : "no plan linked")}
              {row("Krillion bonus", pts.krillion, pts.krillion ? "first in the app this month" : "already done this month")}
              {row("Holiday bonus", pts.holiday, pts.holidayName ?? "regular day")}
              <span className="muted">Rarer activities and full turnout count the most.</span>
            </div>
          </section>
          <section className="card pad">
            <h3>Add a new branch to your story.</h3>
            <p className="muted small" style={{ margin: "4px 0 16px" }}>
              Everyone in {g.name} sees it right away.
            </p>
            <button className="btn btn-primary block" onClick={save}>
              Save activity <Icon name="arrow" />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
