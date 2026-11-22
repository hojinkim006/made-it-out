// Demo data. Dates are relative to "today" so streaks and decay always look alive.
// Demo accounts: passwords are NOT stored here, only their hashes (see lib/auth.ts).
import type { ActivityLog, Cat, Competitor, Group, Plan, State, User } from "../lib/types";
import { CATS, scoreLog } from "../lib/scoring";
import { daysAgo, nextFriday, parseD, iso } from "../lib/dates";
import { estCost } from "../lib/budget";
import { optLabel } from "../lib/plans";

export const STATE_VERSION = 7;

const users: User[] = [
  {
    id: "hojin",
    username: "hojinnyneutron",
    email: "hojiniscool@gmail.com",
    phone: "(617) 555-0101",
    passHash: "6d31b831b9abfcb6314f47db098001a84c2124c27d4e764a8329edf202e8fdc1",
    displayName: "Hojin",
    region: "Boston, MA",
    friendIds: ["david", "andrew", "matt"],
  },
  {
    id: "david",
    username: "vidsteriscool",
    email: "vidster@bu.edu",
    phone: "(617) 555-0102",
    passHash: "cc4dbe60b2ae65326842332d4488009e7b46e2ae5662e62063571aeb014f4ca0",
    displayName: "David",
    region: "Boston, MA",
    school: "Boston University",
    schoolEmail: "vidster@bu.edu",
    friendIds: ["hojin", "andrew", "matt", "john"],
  },
  {
    id: "andrew",
    username: "machoman",
    email: "sunny1208@gmail.com",
    phone: "(617) 555-0103",
    passHash: "b38aafd3aa953bd73e269670bf54471391969424f15974ff2860b0dfa210e529",
    displayName: "Andrew",
    region: "Boston, MA",
    friendIds: ["hojin", "david", "matt", "john"],
  },
  {
    id: "matt",
    username: "mattishere",
    email: "mattishere@gmail.com",
    phone: "(617) 555-0104",
    passHash: "ea1f046e6a6e21b9022cd3b0f78479694c47db297634ae2c962ec00f1fd45440",
    displayName: "Matt",
    region: "Boston, MA",
    friendIds: ["hojin", "david", "andrew"],
  },
  {
    id: "john",
    username: "itsmejohn",
    email: "johnuniversity@gmail.com",
    phone: "(617) 555-0105",
    passHash: "cc3518a2a8895bb7ef4a926038e024b5726d0010f707faad43b4ed52f99ce1d0",
    displayName: "John",
    region: "Boston, MA",
    friendIds: ["david", "andrew"],
  },
  {
    id: "priya",
    username: "priya",
    email: "priya@example.com",
    phone: "(617) 555-0106",
    passHash: "0000000000000000000000000000000000000000000000000000000000000000",
    displayName: "Priya",
    region: "Boston, MA",
    friendIds: ["andrew"],
  },
  {
    id: "sam",
    username: "sam",
    email: "sam@example.com",
    phone: "(617) 555-0107",
    passHash: "0000000000000000000000000000000000000000000000000000000000000000",
    displayName: "Sam",
    region: "Boston, MA",
    friendIds: ["andrew"],
  },
  {
    id: "elena",
    username: "elena",
    email: "elena@example.com",
    phone: "(617) 555-0108",
    passHash: "0000000000000000000000000000000000000000000000000000000000000000",
    displayName: "Elena",
    region: "Boston, MA",
    friendIds: ["andrew"],
  },
];

const SQ = ["hojin", "david", "andrew", "matt"];
const SB = ["david", "john", "andrew"];
const NO = ["hojin", "matt"];
const RIVER = ["andrew", "hojin", "david", "matt", "john", "priya", "sam", "elena"];
const SUN = ["andrew", "david", "john"];
const AFTER = ["andrew", "hojin", "matt"];
const BENCH = ["andrew", "john"];

type RawLog = [
  group: string,
  author: string,
  daysAgo: number,
  title: string,
  cat: Cat,
  labels: string[],
  where: string,
  who: string[],
  description: string,
  planId?: string,
];

const RAW: RawLog[] = [
  ["sq", "david", 118, "Late-night ramen run", "food", ["restaurant", "ramen"], "Yume Wo Katare · Cambridge", ["hojin", "david", "andrew", "matt"], "Forty minutes in line in the cold. Nobody complained once the bowls showed up."],
  ["sq", "hojin", 104, "Skating on the Frog Pond", "sports", ["skating"], "Boston Common", ["hojin", "david", "matt"], "Matt fell exactly once and insists it was on purpose."],
  ["sq", "andrew", 95, "Board game café night", "games", ["board-games", "cafe"], "Knight Moves Café · Brookline", ["david", "andrew", "matt"], "Three hours of Catan. Andrew won twice. We are not over it."],
  ["sq", "matt", 81, "Late night at the MFA", "art", ["museum"], "Museum of Fine Arts · Fenway", SQ, "Split up, met back at the Impressionists, and everyone picked a favorite painting.", "p-mfa"],
  ["sq", "david", 70, "Jazz at Wally's", "music", ["concert", "jazz"], "Wally's Café · South End", ["hojin", "david", "andrew"], "Standing room only. The trumpet solo got a full-room cheer."],
  ["sq", "hojin", 58, "Blue Hills sunrise hike", "outdoors", ["hike"], "Blue Hills Reservation · Milton", SQ, "5:40 a.m. alarm. The view from Great Blue Hill made up for it.", "p-hike"],
  ["sq", "andrew", 44, "Thrift and latte loop", "coffee", ["cafe", "thrift"], "Allston", ["david", "andrew"], "Found a jacket that fits like it was made for him."],
  ["sq", "matt", 30, "Open mic night", "music", ["open-mic"], "The Burren · Somerville", SQ, "Hojin signed up as a joke and then actually played."],
  ["sq", "david", 21, "Duckpin bowling", "games", ["bowling"], "Kings · Back Bay", ["hojin", "david", "matt"], "Lost a ball to the gutter, gained a rivalry."],
  ["sq", "hojin", 14, "Paint and sip", "art", ["painting"], "Somerville", SQ, "Same sunset prompt, four very different sunsets."],
  ["sq", "andrew", 7, "Rock Spot bouldering", "sports", ["climbing"], "Rock Spot Climbing · South Boston", ["hojin", "andrew", "matt"], "Andrew finished his first V3. We made him say it out loud."],
  ["sq", "david", 2, "A different view of the Charles", "water", ["kayak"], "Charles River Canoe & Kayak · Allston", SQ, "Paddled out past the Weeks Bridge. The skyline looks different from the water.", "p-kayak"],
  ["sq", "matt", 1, "Dumpling crawl", "food", ["restaurant", "dumplings"], "Chinatown", ["david", "andrew", "matt"], "Ranked every soup dumpling within four blocks."],
  ["sb", "david", 40, "Midnight cookie run", "food", ["dessert"], "Allston", SB, "Finals-week fuel. We walked back the long way."],
  ["sb", "john", 33, "Study break at the arboretum", "outdoors", ["park"], "Arnold Arboretum · Jamaica Plain", ["david", "john"], "Fresh air between problem sets."],
  ["sb", "andrew", 20, "Trivia night", "games", ["trivia", "bar"], "The Burren · Somerville", SB, "Third place. The music round humbled us."],
  ["no", "hojin", 50, "Castle Island loop", "outdoors", ["walk"], "Castle Island · South Boston", NO, "Windy, salty, perfect. Hot dogs after."],
  ["no", "matt", 35, "Escape room", "games", ["escape-room"], "Trapology · Downtown", NO, "Escaped with 40 seconds left."],
  ["no", "hojin", 12, "Late-night pho", "food", ["restaurant"], "Pho Pasteur · Chinatown", NO, "The only thing open after midnight."],
  ["no", "matt", 5, "Axe throwing", "sports", ["axe-throwing"], "Urban Axes · Somerville", NO, "Hojin hit a bullseye on the first throw and never again."],
  ["su", "david", 4, "Eggs and a long table", "food", ["brunch"], "The Friendly Toast · Allston", SUN, "Nobody looked at a clock."],
  ["ah", "hojin", 11, "Member preview", "art", ["museum", "gallery"], "ICA · Seaport", AFTER, "Stayed until the guards started hovering."],
  ["ob", "andrew", 80, "First thaw", "outdoors", ["walk"], "Public Garden", BENCH, "The swan boats were still in storage."],
  ["ob", "john", 48, "One last warm afternoon", "coffee", ["park"], "Boston Common", BENCH, "The bench by the pond was free, for once."],
];

function pastPlan(id: string, groupId: string, byId: string, logDaysAgo: number, hoursToConfirm: number): Plan {
  const created = parseD(daysAgo(logDaysAgo + 4));
  created.setHours(10);
  const confirmed = new Date(created.getTime() + hoursToConfirm * 36e5);
  const date = daysAgo(logDaysAgo);
  return {
    id,
    groupId,
    title: "",
    where: "",
    note: "",
    price: null,
    est: null,
    byId,
    hostId: byId,
    createdAt: created.toISOString(),
    confirmedAt: confirmed.toISOString(),
    extMs: 0,
    auto: false,
    pickId: null,
    confirmedOptionId: `${id}-o`,
    start: "18:00",
    goingIds: [],
    requests: [],
    options: [{ id: `${id}-o`, byId, date, time: "18:00", resp: {} }],
  };
}

/** Typed prices and ratings from the v3 prototype, matched onto the current outings. */
const EXTRAS: Record<string, { price?: number; ratings?: Record<string, number>; comments?: { by: string; hoursAgo: number; text: string }[] }> = {
  "Late-night ramen run": {
    price: 22,
    ratings: { hojin: 5, david: 4, andrew: 4, matt: 5 },
    comments: [{ by: "hojin", hoursAgo: 118 * 24 - 3, text: "Worth the line. Every time." }],
  },
  "Board game café night": { price: 10, ratings: { david: 4, andrew: 5, matt: 4 } },
  "Late night at the MFA": { ratings: { hojin: 5, david: 4, andrew: 4, matt: 5 } },
  "Jazz at Wally's": {
    price: 15,
    ratings: { hojin: 5, david: 5, andrew: 5 },
    comments: [{ by: "andrew", hoursAgo: 70 * 24 - 4, text: "We need to go back for the Sunday jam." }],
  },
  "Blue Hills sunrise hike": { price: 0, ratings: { hojin: 5, david: 5, andrew: 5, matt: 4 } },
  "Thrift and latte loop": { price: 8, ratings: { david: 4, andrew: 5 } },
  "Open mic night": { price: 5, ratings: { hojin: 5, david: 4, andrew: 4, matt: 5 } },
  "Duckpin bowling": { price: 28, ratings: { hojin: 4, david: 5, matt: 3 } },
  "Paint and sip": { ratings: { hojin: 4, david: 5, matt: 4 } },
  "Rock Spot bouldering": { price: 30, ratings: { hojin: 4, matt: 5 } },
  "A different view of the Charles": {
    ratings: { hojin: 5, david: 5, matt: 5 },
    comments: [{ by: "david", hoursAgo: 30, text: "Warmer than it looks from the bridge." }],
  },
  "Dumpling crawl": {
    price: 18,
    ratings: { david: 5, matt: 4 },
    comments: [{ by: "matt", hoursAgo: 2, text: "The second place on Beach Street still wins." }],
  },
  "Midnight cookie run": { price: 6, ratings: { david: 5, john: 4, andrew: 5 } },
  "Study break at the arboretum": { price: 0, ratings: { david: 4, john: 5 } },
  "Trivia night": { price: 12, ratings: { david: 4, john: 3, andrew: 4 } },
  "Castle Island loop": { price: 0, ratings: { hojin: 5, matt: 4 } },
  "Escape room": { price: 35, ratings: { hojin: 5, matt: 5 } },
  "Late-night pho": { price: 14, ratings: { hojin: 5, matt: 4 } },
  "Axe throwing": { price: 30, ratings: { hojin: 5, matt: 4 } },
};

export const COMPETITORS: Record<"local" | "school" | "duos", Competitor[]> = {
  local: [
    { name: "The Scenic Route", size: 8, hood: "Cambridge", outings: 24, pts: 3240 },
    { name: "Outside-ish", size: 5, hood: "Boston", outings: 21, pts: 2760 },
    { name: "Touch Grass Club", size: 7, hood: "Somerville", outings: 18, pts: 2120 },
    { name: "The Sunday People", size: 4, hood: "Brookline", outings: 11, pts: 1650 },
    { name: "City Sprouts", size: 6, hood: "Boston", outings: 10, pts: 1420 },
    { name: "Night Owls Society", size: 5, hood: "Allston", outings: 9, pts: 1180 },
    { name: "Porch Light Crew", size: 4, hood: "Jamaica Plain", outings: 8, pts: 990 },
    { name: "Second Breakfast Club", size: 5, hood: "Medford", outings: 7, pts: 840 },
    { name: "Small Talk, Big Walks", size: 3, hood: "Roxbury", outings: 6, pts: 720 },
    { name: "Fenway Fridays", size: 4, hood: "Fenway", outings: 3, pts: 390 },
  ],
  school: [
    { name: "Warren Towers Walkers", size: 7, hood: "Boston University", outings: 19, pts: 2410 },
    { name: "Comm Ave Collective", size: 6, hood: "Boston University", outings: 14, pts: 1990 },
    { name: "GSU Snack Society", size: 5, hood: "Boston University", outings: 10, pts: 1210 },
    { name: "Late Night Lab", size: 4, hood: "Boston University", outings: 9, pts: 1100 },
    { name: "Bay State Brunchers", size: 4, hood: "Boston University", outings: 6, pts: 760 },
    { name: "East Campus Explorers", size: 3, hood: "Boston University", outings: 4, pts: 410 },
  ],
  duos: [
    { name: "Two Coffees, Please", size: 2, hood: "Back Bay", outings: 12, pts: 1310 },
    { name: "Ride or Dine", size: 2, hood: "North End", outings: 9, pts: 980 },
    { name: "Plus One", size: 2, hood: "Cambridge", outings: 7, pts: 720 },
    { name: "Sidekicks", size: 2, hood: "Somerville", outings: 4, pts: 410 },
  ],
};

export function seed(now = new Date()): State {
  const groups: Group[] = [
    {
      id: "sq",
      name: "The Side Questers",
      region: "Boston, MA",
      hood: "Boston",
      school: "Boston University",
      createdAt: daysAgo(130, now),
      memberIds: SQ,
      plan: null,
      pastPlans: [pastPlan("p-mfa", "sq", "matt", 81, 3), pastPlan("p-hike", "sq", "hojin", 58, 20), pastPlan("p-kayak", "sq", "david", 2, 1)],
      feed: [],
    },
    {
      id: "sb",
      name: "Study Breakers",
      region: "Boston, MA",
      hood: "Allston",
      school: "Boston University",
      createdAt: daysAgo(45, now),
      memberIds: SB,
      plan: null,
      pastPlans: [],
      feed: [],
    },
    {
      id: "no",
      name: "Night Owls",
      region: "Boston, MA",
      hood: "Chinatown",
      createdAt: daysAgo(60, now),
      memberIds: NO,
      plan: null,
      pastPlans: [],
      feed: [],
    },
    {
      id: "rv",
      name: "River Rats",
      region: "Boston, MA",
      hood: "Cambridge",
      createdAt: daysAgo(12, now),
      memberIds: RIVER,
      plan: null,
      pastPlans: [],
      feed: [],
    },
    {
      id: "su",
      name: "Sunday Table",
      region: "Boston, MA",
      hood: "Brookline",
      school: "Boston University",
      createdAt: daysAgo(110, now),
      memberIds: SUN,
      plan: null,
      pastPlans: [],
      feed: [],
    },
    {
      id: "ah",
      name: "After Hours",
      region: "Boston, MA",
      hood: "Seaport",
      school: "Boston University",
      createdAt: daysAgo(60, now),
      memberIds: AFTER,
      plan: null,
      pastPlans: [],
      feed: [],
    },
    {
      id: "ob",
      name: "The Old Bench",
      region: "Boston, MA",
      hood: "Boston",
      createdAt: daysAgo(250, now),
      memberIds: BENCH,
      plan: null,
      pastPlans: [],
      feed: [],
    },
  ];

  // Side Questers has a plan mid-vote so the new confirmation rules are visible immediately.
  // Friday already has the host plus two others (one only partly free), which is enough to confirm.
  const posted = new Date(now.getTime() - 20 * 36e5);
  const fri = nextFriday(now);
  const sat = (() => {
    const d = parseD(fri);
    d.setDate(d.getDate() + 1);
    return iso(d);
  })();
  const o1 = { date: fri, time: "17:00" };
  const o2 = { date: sat, time: "18:00" };
  groups[0].plan = {
    id: "p-giving",
    groupId: "sq",
    title: "Friendsgiving potluck",
    where: "Andrew's place · Allston",
    note: "Everyone brings one dish. Matt is on pie duty, no arguments.",
    price: null,
    est: estCost("Friendsgiving potluck", "Andrew's place · Allston"),
    byId: "andrew",
    hostId: "andrew",
    createdAt: posted.toISOString(),
    extMs: 0,
    auto: false,
    pickId: null,
    confirmedOptionId: null,
    start: null,
    goingIds: [],
    requests: [],
    options: [
      { id: "o1", byId: "andrew", ...o1, resp: { andrew: { a: "yes" }, matt: { a: "yes" }, david: { a: "part", from: "18:30" } } },
      { id: "o2", byId: "david", ...o2, resp: { david: { a: "yes" }, matt: { a: "maybe" } } },
    ],
  };
  groups[0].feed = [
    { id: "f1", t: posted.getTime(), byId: "andrew", k: "post", title: "Friendsgiving potluck", opt: optLabel(o1) },
    { id: "f2", t: now.getTime() - 18 * 36e5, byId: "matt", k: "resp", ans: "Yes", opt: optLabel(o1) },
    { id: "f3", t: now.getTime() - 10 * 36e5, byId: "david", k: "resp", ans: "Partly (after 6:30 PM)", opt: optLabel(o1) },
    { id: "f4", t: now.getTime() - 6 * 36e5, byId: "david", k: "suggest", opt: optLabel(o2) },
    { id: "f5", t: now.getTime() - 4 * 36e5, byId: "matt", k: "resp", ans: "If needed", opt: optLabel(o2) },
    { id: "f6", t: now.getTime() - 2 * 36e5, byId: "matt", k: "comment", title: "Dumpling crawl", text: "The second place on Beach Street still wins." },
  ];

  const logs: ActivityLog[] = [];
  const chronological = [...RAW].sort((a, b) => b[2] - a[2]);
  chronological.forEach(([gid, author, ago, title, cat, labels, where, who, description, planId], i) => {
    const g = groups.find((x) => x.id === gid)!;
    const date = daysAgo(ago, now);
    const plan = planId ? g.pastPlans.find((p) => p.id === planId) : undefined;
    logs.push({
      id: `l${i + 1}`,
      groupId: gid,
      authorId: author,
      title,
      description,
      cat,
      emoji: CATS[cat].emoji,
      labels,
      date,
      where,
      attendeeIds: who,
      media: [],
      eventId: plan?.id,
      price: EXTRAS[title]?.price ?? null,
      est: estCost(title, where, cat),
      ratings: EXTRAS[title]?.ratings ?? {},
      comments: (EXTRAS[title]?.comments ?? []).map((c, ci) => ({
        id: `c${i}-${ci}`,
        byId: c.by,
        t: now.getTime() - c.hoursAgo * 36e5,
        text: c.text,
      })),
      points: scoreLog({ cat, labels, date, attendeeIds: who }, g.memberIds.length, logs, plan),
    });
  });

  return { version: STATE_VERSION, users, groups, logs };
}
