import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, uid } from "../store";
import { useNav } from "../nav";
import { CatIcon, Icon } from "../components/Icons";
import { RarityTag, PlaceSearch } from "../components/PlaceSearch";
import { rarityPercentile, spotById, usePlaceData, type Spot } from "../lib/places";
import { MAX_FRUIT } from "../components/Tree";
import { CATS, normLabel, scoreLog } from "../lib/scoring";
import { todayISO } from "../lib/dates";
import { estCost, fmtRange, rateLog } from "../lib/budget";
import { eventWhen } from "../lib/plans";
import { Stars } from "../components/Stars";
import { groupInfo } from "../lib/groupInfo";
import type { ActivityLog, Cat, Media } from "../lib/types";
import { errorText, uploadMedia } from "../db";

/** Matches the 50 MB file limit on the Supabase "media" bucket. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Downscale photos before upload (max 1000px, JPEG). */
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
export function LogPage() {
  const { me, state, board, myGroups, update, toast } = useStore();
  const { route, go } = useNav();
  const [gid, setGid] = useState(route.groupId ?? myGroups[0]?.id);
  const g = myGroups.find((x) => x.id === gid) ?? myGroups[0];
  const seededWhen = g?.plan?.confirmedOptionId ? eventWhen(g.plan) : null;
  const [title, setTitle] = useState(g?.plan?.confirmedOptionId ? g.plan.title : "");
  const [where, setWhere] = useState(g?.plan?.confirmedOptionId ? g.plan.where : "");
  const [date, setDate] = useState(seededWhen?.date ?? todayISO());
  const [who, setWho] = useState<string[]>(g ? (g.plan?.confirmedOptionId ? g.plan.goingIds : g.memberIds) : []);
  const [cat, setCat] = useState<Cat>("food");
  const [emoji, setEmoji] = useState(CATS.food.emoji);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(g?.plan?.confirmedOptionId && g.plan.price != null ? String(g.plan.price) : "");
  const [myRate, setMyRate] = useState(0);
  const [media, setMedia] = useState<Media[]>([]);
  /** Original files for videos, keyed by media id. Photos upload from their resized preview. */
  const videoFiles = useRef(new Map<string, Blob>());
  const [saving, setSaving] = useState(false);
  const [linkPlan, setLinkPlan] = useState(!!g?.plan?.confirmedOptionId);
  const [placeId, setPlaceId] = useState<string | undefined>(g?.plan?.confirmedOptionId ? g.plan.placeId : undefined);
  const data = usePlaceData();
  const spot = data ? spotById(data, placeId) : null;
  const [bad, setBad] = useState(false);
  const [shown, setShown] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = linkPlan ? (g?.plan ?? undefined) : undefined;
  const pts = useMemo(
    () =>
      g
        ? scoreLog({ cat, labels, date: date || todayISO(), attendeeIds: who }, g.memberIds.length, board.logs, plan, {
            labelRarity: data?.labels,
            placeRarity: spot?.rarity,
          })
        : null,
    [g, cat, labels, date, who, board.logs, plan, data, spot],
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
    setWho(ng.plan?.confirmedOptionId && ng.plan.goingIds.length ? ng.plan.goingIds : ng.memberIds);
    setLinkPlan(!!ng.plan?.confirmedOptionId);
    const when = ng.plan ? eventWhen(ng.plan) : null;
    if (when) setDate(when.date);
  };

  const pick = (s: Spot) => {
    setPlaceId(s.id);
    setWhere(`${s.name} · ${s.hood}`);
    setCat(s.cat);
    setEmoji(s.emoji);
    setLabels((ls) => [...s.labels, ...ls.filter((l) => !s.labels.includes(l))]);
    if (!title.trim()) setTitle(s.date ? s.name : `${s.kindLabel} at ${s.name}`);
    if (s.date && s.date <= todayISO()) setDate(s.date);
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
        if (f.size > MAX_VIDEO_BYTES) toast(`${f.name} is over 50 MB`);
        else {
          const id = uid();
          videoFiles.current.set(id, f);
          out.push({ id, kind: "video", url: URL.createObjectURL(f) });
        }
      }
    }
    setMedia((m) => [...m, ...out]);
  };

  const save = async () => {
    if (saving) return;
    if (!title.trim()) return setBad(true);
    if (!who.length) return toast("Pick at least one person who made it out");
    const typed = price.trim() === "" ? null : Math.round(Number(price));
    if (typed !== null && (Number.isNaN(typed) || typed < 0)) return toast("Cost has to be zero or more");
    const attendees = g.memberIds.filter((m) => who.includes(m));
    const logId = uid();
    let uploaded: Media[];
    setSaving(true);
    try {
      uploaded = await Promise.all(
        media.map(async (m) => {
          const blob = videoFiles.current.get(m.id) ?? (await (await fetch(m.url)).blob());
          return { ...m, url: await uploadMedia(g.id, logId, m.id, blob) };
        }),
      );
    } catch (e) {
      setSaving(false);
      return toast(`Couldn't upload photos/videos: ${errorText(e)}`);
    }
    setSaving(false);
    const log: ActivityLog = {
      id: logId,
      groupId: g.id,
      authorId: me!.id,
      title: title.trim(),
      description: desc.trim(),
      cat,
      emoji: emoji.trim() || CATS[cat].emoji,
      labels,
      date: date || todayISO(),
      where: where.trim(),
      attendeeIds: attendees,
      media: uploaded,
      eventId: plan?.id,
      placeId: spot?.id,
      price: typed,
      est: estCost(title.trim(), where.trim(), cat),
      ratings: {},
      comments: [],
      points: pts,
    };
    const ok = update((s) => {
      s.logs.push(log);
      if (myRate && attendees.includes(me!.id)) rateLog(s, log.id, me!.id, myRate);
      const gg = s.groups.find((x) => x.id === g.id)!;
      if (plan && gg.plan && gg.plan.id === plan.id) {
        gg.pastPlans.push(gg.plan);
        gg.plan = null;
      }
    });
    if (!ok) return toast("Couldn't save. Are you still signed in?");
    const after = groupInfo({ ...state, logs: [...state.logs, log] }, g).logs.findIndex((l) => l.id === log.id);
    go("group", { groupId: g.id, grow: after < MAX_FRUIT ? after : null });
    toast(`+${pts.total} pts${pts.firstBloom ? " · First Bloom! First in the app this month" : ""} · a new branch grew`);
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
                    setWho(g.plan!.confirmedOptionId && g.plan!.goingIds.length ? g.plan!.goingIds : g.memberIds);
                    setPlaceId(g.plan!.placeId);
                    setPrice(g.plan!.price != null ? String(g.plan!.price) : "");
                    const when = eventWhen(g.plan!);
                    if (when) setDate(when.date);
                  }
                }}
              />
              This is our plan: <b>{g.plan.title}</b> {g.plan.confirmedOptionId ? "(confirmed, earns speed points)" : "(not confirmed yet)"}
            </label>
          )}
          <label className="f">
            <span>Activity</span>
            <input className={`field${bad ? " err" : ""}`} value={title} onChange={(e) => (setTitle(e.target.value), setBad(false))} placeholder="A different view of the Charles" />
          </label>
          <div className="f">
            <span>
              Location <em>pick a real place to score its rarity from the datasets</em>
            </span>
            <PlaceSearch
              data={data}
              value={where}
              picked={spot}
              onText={(v) => {
                setWhere(v);
                setPlaceId(undefined);
              }}
              onPick={pick}
            />
            {spot && data && (
              <div className="picked">
                <span className="place-emoji">{spot.emoji}</span>
                <span className="t">
                  <b>
                    {spot.kindLabel} · rarity {spot.rarity.toFixed(2)}
                  </b>
                  <span className="muted">{spot.detail}</span>
                </span>
                <RarityTag rarity={spot.rarity} data={data} />
                <button className="link" onClick={() => setPlaceId(undefined)}>
                  Clear
                </button>
              </div>
            )}
          </div>
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
          <label className="f">
            <span>
              What it cost per person <em>optional</em>
            </span>
            <div className="money-in">
              <span>$</span>
              <input className="field" type="number" min={0} step={1} inputMode="decimal" placeholder="Leave blank to use the estimate" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <small className="hint">{estCost(title, where, cat) ? `Gemini estimate (simulated): ${fmtRange(estCost(title, where, cat))} per person` : "Add a place and we can estimate the cost."}</small>
          </label>
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
            <span>
              How was it? <em>your rating · everyone who went can rate later</em>
            </span>
            <Stars value={myRate} onRate={setMyRate} />
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
                  <span className="bonus">{spot ? "tree icon" : `rarity +${Math.round(CATS[k].rarity * 100)}`}</span>
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
              Photos & videos <em>optional, videos up to 50 MB</em>
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
              {row(
                "Rarity",
                pts.rarity,
                spot && data
                  ? `${spot.name}, rarer than ${rarityPercentile(data, spot.rarity)}% of Boston spots`
                  : labels.length
                    ? "category or rarest label"
                    : CATS[cat].label,
              )}
              {row("Group turnout", pts.turnout, `${who.length} of ${g.memberIds.length}`)}
              {row("Finalization speed", pts.speed, plan ? (plan.confirmedAt ? "linked plan" : "plan not locked in") : "no plan linked")}
              {row("First Bloom bonus", pts.firstBloom, pts.firstBloom ? "first in the app this month" : "already done this month")}
              {row("Holiday bonus", pts.holiday, pts.holidayName ?? "regular day")}
              <span className="muted">Rarer activities and full turnout count the most.</span>
            </div>
          </section>
          <section className="card pad">
            <h3>Add a new branch to your story.</h3>
            <p className="muted small" style={{ margin: "4px 0 16px" }}>
              Everyone in {g.name} sees it right away.
            </p>
            <button className="btn btn-primary block" onClick={() => void save()} disabled={saving}>
              {saving ? "Uploading…" : "Save activity"} <Icon name="arrow" />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
