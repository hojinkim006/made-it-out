import { currentUserId, events, groups, logs, nicheness, users } from "../data/mock";
import { GroupTree } from "../components/GroupTree";
import { groupScore } from "../lib/scoring";

export function ProfilePage({ onOpenGroup }: { onOpenGroup: (id: string) => void }) {
  const me = users.find((u) => u.id === currentUserId)!;
  const myGroups = groups.filter((g) => me.groupIds.includes(g.id));
  const myLogs = logs.filter((l) => l.attendeeIds.includes(me.id));
  const categories = new Set(myLogs.map((l) => l.category));

  return (
    <section>
      <h1>Hi, {me.name} 👋</h1>
      <div className="stats">
        <div className="card stat"><strong>{myLogs.length}</strong><span>hangouts</span></div>
        <div className="card stat"><strong>{categories.size}</strong><span>activity types</span></div>
        <div className="card stat"><strong>{myGroups.length}</strong><span>groups</span></div>
      </div>
      <h2>Your groups</h2>
      <div className="grid">
        {myGroups.map((g) => (
          <button key={g.id} className="card group-card" onClick={() => onOpenGroup(g.id)}>
            <GroupTree group={g} logs={logs} size={56} />
            <div>
              <h3>{g.name}</h3>
              <p className="muted">{g.location} · {g.memberIds.length} members</p>
              <p className="points">{groupScore(g.id, logs, events, nicheness)} pts</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
