import { useState } from "react";
import { ProfilePage } from "./pages/ProfilePage";
import { GroupPage } from "./pages/GroupPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { groups } from "./data/mock";

type Tab = "profile" | "group" | "leaderboard";

export default function App() {
  const [tab, setTab] = useState<Tab>("profile"); // opens to profile
  const [groupId, setGroupId] = useState(groups[0].id);

  return (
    <div className="app">
      <nav className="tabs">
        <span className="brand">🌳 Make It Out</span>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Profile</button>
        <button className={tab === "group" ? "active" : ""} onClick={() => setTab("group")}>Group</button>
        <button className={tab === "leaderboard" ? "active" : ""} onClick={() => setTab("leaderboard")}>Leaderboard</button>
      </nav>
      <main>
        {tab === "profile" && <ProfilePage onOpenGroup={(id) => { setGroupId(id); setTab("group"); }} />}
        {tab === "group" && <GroupPage groupId={groupId} />}
        {tab === "leaderboard" && <LeaderboardPage />}
      </main>
    </div>
  );
}
