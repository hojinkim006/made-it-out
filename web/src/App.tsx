import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import { NavCtx, type Route, type View } from "./nav";
import { Icon, SvgDefs } from "./components/Icons";
import { Seg } from "./components/Sheet";
import { AuthPage } from "./pages/AuthPage";
import { ProfilePage } from "./pages/ProfilePage";
import { GroupPage } from "./pages/GroupPage";
import { PlanPage } from "./pages/PlanPage";
import { LogPage } from "./pages/LogPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { EditProfileSheet, SettingsSheet } from "./pages/AccountSheets";

export default function App() {
  const { me, toasts, reset, signOut } = useStore();
  const [route, setRoute] = useState<Route>({ view: "profile" });
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<"settings" | "edit" | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const go = useCallback((view: View, opts: Omit<Route, "view"> = {}) => {
    setRoute((r) => ({ view, groupId: opts.groupId ?? r.groupId, tab: opts.tab ?? (view === "group" ? "overview" : r.tab), grow: opts.grow ?? null }));
    setAnimKey((k) => k + 1);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, []);
  const nav = useMemo(() => ({ route, go }), [route, go]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const tab = route.view === "plan" || route.view === "log" ? "group" : route.view;

  return (
    <NavCtx.Provider value={nav}>
      <SvgDefs />
      <header className="nav">
        <div className="nav-in">
          <button className="logo" onClick={() => go("profile")} aria-label="Home">
            <span className="logo-mark">
              <svg viewBox="0 0 24 24">
                <path d="M12 21v-9M12 12l-4-4M12 14l4-4M12 9V4" />
              </svg>
            </span>
            <span>make it out.</span>
          </button>
          <nav className="nav-center">
            {me && (
              <Seg
                id="navSeg"
                value={tab as "profile" | "group" | "leaderboard"}
                onChange={(k) => go(k)}
                options={[
                  { key: "profile", label: <><span className="yr">Your </span>profile</> },
                  { key: "group", label: <><span className="yr">Your </span>groups</> },
                  { key: "leaderboard", label: "Leaderboard" },
                ]}
              />
            )}
          </nav>
          {me && (
            <div className="nav-right">
              <span className="loc">
                <Icon name="pin" />
                <span>{me.region}</span>
              </span>
              <div className="menu-wrap" ref={menuRef}>
                <button className="me" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                  <span className="av">{me.displayName[0]}</span>
                  <span>{me.displayName}</span>
                  <Icon name="chevD" size={14} />
                </button>
                {menu && (
                  <div className="menu" role="menu">
                    <div className="menu-head">
                      <b>{me.displayName}</b>
                      <span>@{me.username}</span>
                    </div>
                    <button role="menuitem" onClick={() => (setSheet("edit"), setMenu(false))}>
                      <Icon name="edit" /> Edit profile
                    </button>
                    <button role="menuitem" onClick={() => (setSheet("settings"), setMenu(false))}>
                      <Icon name="gear" /> Settings
                    </button>
                    <button role="menuitem" onClick={() => (signOut(), setMenu(false))}>
                      <Icon name="out" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        <section className="view active" key={me ? `${route.view}-${animKey}` : "auth"}>
          {!me ? (
            <AuthPage />
          ) : route.view === "profile" ? (
            <ProfilePage />
          ) : route.view === "group" ? (
            <GroupPage />
          ) : route.view === "plan" ? (
            <PlanPage />
          ) : route.view === "log" ? (
            <LogPage />
          ) : (
            <LeaderboardPage />
          )}
        </section>
      </main>

      <footer>
        <div className="foot">
          <span>Less group chat. More good stories.</span>
          <span>
            Boston · Demo data{" "}
            <button
              onClick={() => {
                if (confirm("Reset all demo data in every open window?")) reset();
              }}
            >
              Reset demo
            </button>
          </span>
        </div>
      </footer>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name="spark" /> {t.text}
          </div>
        ))}
      </div>

      {me && sheet === "settings" && <SettingsSheet onClose={() => setSheet(null)} />}
      {me && sheet === "edit" && <EditProfileSheet onClose={() => setSheet(null)} />}
    </NavCtx.Provider>
  );
}
