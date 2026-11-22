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
import { supabaseConfigured } from "./supabase";

export default function App() {
  const { me, status, error, reload, toasts, signOut, recovery, endRecovery } = useStore();
  const [route, setRoute] = useState<Route>({ view: "profile" });
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<"settings" | "edit" | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const go = useCallback((view: View, opts: Omit<Route, "view"> = {}) => {
    setRoute((r) => ({ view, groupId: opts.groupId ?? r.groupId, tab: opts.tab ?? (view === "group" ? "overview" : r.tab), grow: opts.grow ?? null, prefill: opts.prefill }));
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

  const tab = route.view === "leaderboard" ? "leaderboard" : "profile";
  const showWelcome = supabaseConfigured && status === "ready" && !me;

  if (showWelcome) {
    return (
      <NavCtx.Provider value={nav}>
        <SvgDefs />
        <AuthPage />
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              <Icon name="spark" /> {t.text}
            </div>
          ))}
        </div>
      </NavCtx.Provider>
    );
  }

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
            <span>made it out.</span>
          </button>
          <nav className="nav-center">
            {me && (
              <Seg
                id="navSeg"
                value={tab}
                onChange={(k) => go(k)}
                options={[
                  { key: "profile", label: <><span className="yr">Your </span>profile</> },
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
                    <button role="menuitem" onClick={() => (void signOut(), setMenu(false))}>
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
          {!supabaseConfigured ? (
            <section className="card pad-lg">
              <h2>Almost there.</h2>
              <p className="sub">
                The app can't find its Supabase settings: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
              </p>
              <p className="sub">
                <b>On Netlify:</b> add both under Site configuration → Environment variables, then Deploys → Trigger deploy. They're read
                when the site is built, so the deploy has to run after adding them.
              </p>
              <p className="sub">
                <b>On your computer:</b> add both to <code>web/.env.local</code>, then restart <code>npm run dev</code>.
              </p>
            </section>
          ) : status === "loading" ? (
            <section className="card pad-lg">
              <p className="muted">Loading…</p>
            </section>
          ) : status === "error" ? (
            <section className="card pad-lg">
              <h2>Couldn't load your data.</h2>
              <p className="err-text">{error}</p>
              <div className="row gap mt">
                <button className="btn btn-primary sm" onClick={() => void reload()}>
                  Try again
                </button>
                <button className="btn btn-secondary sm" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </section>
          ) : !me ? (
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
          <span>
            Places © OpenStreetMap contributors · Boston
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

      {/* A password-reset link signs you in; Settings opens to set a new password. */}
      {me && (sheet === "settings" || recovery) && <SettingsSheet onClose={() => (setSheet(null), endRecovery())} />}
      {me && sheet === "edit" && <EditProfileSheet onClose={() => setSheet(null)} />}
    </NavCtx.Provider>
  );
}
