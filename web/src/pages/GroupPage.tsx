import { events, groups, logs, nicheness, users } from "../data/mock";
import { GroupTree } from "../components/GroupTree";
import { groupScore, scoreActivity } from "../lib/scoring";

const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export function GroupPage({ groupId }: { groupId: string }) {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return <p>Group not found.</p>;
  const groupLogs = logs.filter((l) => l.groupId === group.id).sort((a, b) => a.date.localeCompare(b.date));
  const groupEvents = events.filter((e) => e.groupId === group.id && e.status === "open");

  return (
    <section>
      <div className="group-header">
        <GroupTree group={group} logs={logs} />
        <div>
          <h1>{group.name}</h1>
          <p className="muted">📍 {group.location}</p>
          <p className="points">{groupScore(group.id, logs, events, nicheness)} pts</p>
          <p className="muted">{group.memberIds.map(nameOf).join(", ")}</p>
        </div>
      </div>

      <h2>Upcoming events</h2>
      {groupEvents.length === 0 && <p className="muted">No open events. Propose one!</p>}
      {groupEvents.map((e) => (
        <div key={e.id} className="card">
          <h3>{e.title} @ {e.place}</h3>
          <p>{fmt(e.proposedTime)}</p>
          <ul className="votes">
            {e.votes.map((v) => (
              <li key={v.userId}>
                {nameOf(v.userId)}: {v.choice === "yes" ? "✅ in" : v.choice === "no" ? "❌ out" : `🕒 suggests ${fmt(v.altTime!)}`}
              </li>
            ))}
          </ul>
          {/* TODO(M3): vote buttons + confirm */}
        </div>
      ))}

      <h2>Log history</h2>
      <ul className="log-list">
        {groupLogs.map((l, i) => {
          const s = scoreActivity(l, groupLogs.slice(0, i), nicheness);
          return (
            <li key={l.id} className="card log">
              <span className="log-emoji">{l.emoji}</span>
              <div>
                <strong>{l.placeName}</strong> <span className="muted">· {l.category}</span>
                <p className="muted">{l.date} · {l.attendeeIds.map(nameOf).join(", ")}</p>
              </div>
              <span className="points">
                +{s.total}
                {s.holiday && <small> 🎉 {s.holiday}</small>}
              </span>
            </li>
          );
        })}
      </ul>
      {/* TODO(M2): "Log an activity" form (place via Google Maps, date, attendees) */}
    </section>
  );
}
