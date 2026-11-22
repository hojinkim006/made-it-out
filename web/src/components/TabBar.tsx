import { useNav, type View } from "../nav";
import { Icon, type IconName } from "./Icons";

const TABS: { view: View | "me"; label: string; icon: IconName; main?: boolean }[] = [
  { view: "profile", label: "Trees", icon: "home" },
  { view: "leaderboard", label: "Ranks", icon: "trophy" },
  { view: "plan", label: "Plan", icon: "plus", main: true },
  { view: "log", label: "Log", icon: "leaf" },
  { view: "me", label: "Me", icon: "user" },
];

/** Bottom navigation on phones. Hidden on wider screens, where the top nav does this job. */
export function TabBar({ onMe }: { onMe: () => void }) {
  const { route, go } = useNav();
  // A group page belongs to the Trees tab.
  const current = route.view === "group" ? "profile" : route.view;
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const on = t.view === current;
        return (
          <button
            key={t.view}
            type="button"
            className={`tab${on ? " on" : ""}${t.main ? " main" : ""}`}
            aria-current={on ? "page" : undefined}
            onClick={() => (t.view === "me" ? onMe() : go(t.view))}
          >
            <span className="tab-ico">
              <Icon name={t.icon} size={t.main ? 22 : 20} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
