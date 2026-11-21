import { useState } from "react";
import { events, groups, logs, nicheness } from "../data/mock";
import { leaderboard } from "../lib/scoring";
import { GroupTree } from "../components/GroupTree";

const locations = Array.from(new Set(groups.map((g) => g.location)));

export function LeaderboardPage() {
  const [location, setLocation] = useState<string>("");
  const rows = leaderboard(groups, logs, events, nicheness, { location: location || undefined });

  return (
    <section>
      <h1>Leaderboard</h1>
      <label>
        Area:{" "}
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">Everywhere</option>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <ol className="leaderboard">
        {rows.map((r) => (
          <li key={r.group.id} className="card">
            <span className="rank">#{r.rank}</span>
            <GroupTree group={r.group} logs={[]} size={32} />
            <span className="lb-name">{r.group.name}</span>
            <span className="points">{r.score} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
