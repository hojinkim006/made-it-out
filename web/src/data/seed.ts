// Demo data. Dates are relative to "today" so streaks and decay always look alive.
// Demo accounts: passwords are NOT stored here, only their hashes (see lib/auth.ts).
import type { ActivityLog, Cat, Competitor, Group, Plan, State, User } from "../lib/types";
import { CATS, scoreLog } from "../lib/scoring";
import { daysAgo, nextFriday, parseD, iso } from "../lib/dates";

export const STATE_VERSION = 2;

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
];

const SQ = ["hojin", "david", "andrew", "matt"];
const SB = ["david", "john", "andrew"];
const NO = ["hojin", "matt"];

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
];

function pastPlan(id: string, groupId: string, byId: string, logDaysAgo: number, hoursToConfirm: number): Plan {
  const created = parseD(daysAgo(logDaysAgo + 4));
  created.setHours(10);
  const confirmed = new Date(created.getTime() + hoursToConfirm * 36e5);
  return {
    id,
    groupId,
    title: "",
    where: "",
    date: daysAgo(logDaysAgo),
    time: "18:00",
    note: "",
    byId,
    createdAt: created.toISOString(),
    confirmedAt: confirmed.toISOString(),
    inIds: [],
    outIds: [],
    suggestions: [],
  };
}

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
    },
  ];

  // Study Breakers has a plan in progress so the Votes tab has something to show.
  const posted = new Date(now.getTime() - 26 * 36e5);
  const fri = nextFriday(now);
  const sat = (() => {
    const d = parseD(fri);
    d.setDate(d.getDate() + 1);
    return iso(d);
  })();
  groups[1].plan = {
    id: "p-pottery",
    groupId: "sb",
    title: "Pottery after hours",
    where: "The Clayroom · 1408 Beacon St, Brookline",
    date: fri,
    time: "18:30",
    note: "Let's try something new. Beginner-friendly, no skills required!",
    byId: "john",
    createdAt: posted.toISOString(),
    inIds: ["john"],
    outIds: [],
    suggestions: [{ id: "s1", byId: "andrew", date: sat, time: "14:00", voterIds: ["andrew"] }],
  };

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
      points: scoreLog({ cat, labels, date, attendeeIds: who }, g.memberIds.length, logs, plan),
    });
  });

  return { version: STATE_VERSION, users, groups, logs };
}
