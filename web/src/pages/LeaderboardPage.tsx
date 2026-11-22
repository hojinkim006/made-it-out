import { useState } from "react";
import { useStore } from "../store";
import { useNav } from "../nav";
import { Icon } from "../components/Icons";
import { Seg } from "../components/Sheet";
import { boardRows, isDuo, type BoardScope } from "../lib/scoring";
import { COMPETITORS } from "../data/seed";

const fmtN = (n: number) => n.toLocaleString("en-US");

export function LeaderboardPage() {
  const { me, board, myGroups } = useStore();
  const { go } = useNav();
  const [scope, setScope] = useState<BoardScope>("local");
  const [focus, setFocus] = useState<string | null>(null);
  const city = me!.region.split(",")[0];

  const rows = boardRows(scope, board.groups, board.logs, scope === "school" && me!.school !== "Boston University" ? [] : COMPETITORS[scope], {
    region: me!.region,
    school: me!.school,
    mineIds: myGroups.map((g) => g.id),
  });
  const mineIn = rows.filter((r) => r.mine);
  const fr = mineIn.find((r) => r.id === focus) ?? mineIn[0];
  const place = scope === "local" ? `in ${city}` : scope === "school" ? `at ${me!.school}` : "among duos";
  const third = rows[2];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">A little friendly competition</div>
          <h1>Big memories. Local legends.</h1>
          <p className="sub">The groups making the most of their city, one side quest at a time.</p>
        </div>
      </div>
      <div className="board-bar">
        <Seg
          value={scope}
          onChange={setScope}
          options={[
            { key: "local", label: city },
            { key: "school", label: "My school" },
            { key: "duos", label: "Duos" },
          ]}
        />
        <span className="muted small">
          {scope === "duos" ? "Groups of 2 compete separately · " : "Groups of 3–8 · "}All-time with streaks and decay · Live
        </span>
      </div>
      {scope === "school" && !me!.school ? (
        <div className="card pad-lg empty">
          <h2>Verify your university.</h2>
          <p>Add your .edu email in Settings (profile menu, top right) to join your school's board.</p>
        </div>
      ) : (
        <div className="grid-side">
          <section className="card board">
            <div className="brow head">
              <span>Rank</span>
              <span>Group</span>
              <span className="n">Outings</span>
              <span className="p">Points</span>
            </div>
            {rows.length === 0 && <p className="muted pad">No groups here yet.</p>}
            {rows.map((r) => (
              <div
                key={r.id ?? r.name}
                className={`brow${r.mine ? " mine" : ""}${r.rank <= 3 ? " top" : ""}`}
                onClick={r.mine ? () => go("group", { groupId: r.id }) : undefined}
              >
                <span className="rk">{String(r.rank).padStart(2, "0")}</span>
                <span className="nm">
                  <b>{r.name}</b>
                  <span className="muted">
                    {r.size} friends · {r.hood}
                  </span>
                </span>
                <span className="n">{r.outings}</span>
                <span className="p">{fmtN(r.pts)}</span>
              </div>
            ))}
          </section>
          <aside className="stack">
            {fr ? (
              <section className="card rank-card">
                <div className="eyebrow">{fr.name}</div>
                <div className="bigrank">#{fr.rank}</div>
                <p>{place}</p>
                <div className="gap-line">
                  <b>
                    {fr.rank === 1
                      ? "Top of the board."
                      : fr.rank <= 3
                        ? `${fmtN(rows[fr.rank - 2].pts - fr.pts)} points from #${fr.rank - 1}.`
                        : `${fmtN(third.pts - fr.pts)} points from the top three.`}
                  </b>
                  <p>{fr.rank <= 3 ? "Keep the streak going." : "Your next outing could shake things up."}</p>
                </div>
                {mineIn.length > 1 && (
                  <select className="field" value={fr.id} onChange={(e) => setFocus(e.target.value)}>
                    {mineIn.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </section>
            ) : (
              <section className="card pad">
                <h3>None of your groups are here.</h3>
                <p className="muted small" style={{ marginTop: 6 }}>
                  {scope === "duos"
                    ? "Duos are groups of exactly 2."
                    : myGroups.some((g) => !isDuo(g))
                      ? "Your groups are on a different board."
                      : "Start a group of 3–8 to join this board."}
                </p>
              </section>
            )}
            <section className="card pad tips">
              <h3>
                How points
                <br />
                add up.
              </h3>
              <div>
                <b>1. Try the unexpected</b>
                <span>Rarer activities earn the most, up to +100.</span>
              </div>
              <div>
                <b>2. Bring the whole crew</b>
                <span>Turnout counts nonlinearly, up to +60. A few people can't farm points.</span>
              </div>
              <div>
                <b>3. Decide fast</b>
                <span>Lock plans in quickly for up to +40.</span>
              </div>
              <div>
                <b>4. First Bloom</b>
                <span>First log of an activity in the app this month: +30.</span>
              </div>
              <div>
                <b>5. Celebrate</b>
                <span>Holidays add +20. Streaks add bonus points; long quiet stretches decay them.</span>
              </div>
              <button className="btn btn-primary block mt" onClick={() => go("log")}>
                Log an outing <Icon name="arrow" />
              </button>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
