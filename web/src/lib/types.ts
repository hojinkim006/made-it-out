export type ID = string;

export interface User {
  id: ID;
  username: string; // unique, used to add friends
  email: string;
  phone: string;
  passHash: string; // sha256("username:password"), demo only, not real security
  displayName: string;
  region: string; // e.g. "Boston, MA", picks the local leaderboard
  school?: string; // set once university email is verified
  schoolEmail?: string;
  friendIds: ID[];
}

export type Cat = "water" | "art" | "food" | "music" | "outdoors" | "coffee" | "games" | "sports";

export interface Media {
  id: ID;
  kind: "image" | "video";
  url: string; // data URL (demo storage)
}

export interface PointBreakdown {
  niche: number;
  turnout: number;
  speed: number;
  krillion: number;
  holiday: number;
  holidayName: string | null;
  total: number;
}

/** Per-person cost range. A stand-in for a Gemini estimate when nobody typed a price. */
export interface CostRange {
  lo: number;
  hi: number;
}

export interface Comment {
  id: ID;
  byId: ID;
  t: number; // epoch ms
  text: string;
}

export interface ActivityLog {
  id: ID;
  groupId: ID;
  authorId: ID; // the individual who logged it; group score = sum of members' log points
  title: string;
  description: string;
  cat: Cat;
  emoji: string; // shown as fruit on the tree
  labels: string[]; // manual labels, e.g. "restaurant"
  date: string; // YYYY-MM-DD
  where: string;
  attendeeIds: ID[];
  media: Media[];
  eventId?: ID; // set when logged from a planned event
  placeId?: string; // OSM place ("node/123") or Boston event ("event/PUB1") from web/public/data
  /** What someone typed, per person. Null means use the estimate. */
  price: number | null;
  est: CostRange | null;
  /** Star ratings from people who went, 1–5. */
  ratings: Record<ID, number>;
  comments: Comment[];
  points: PointBreakdown;
}

/** Per-time answer. Yes and Partly count as free; If needed and No do not. */
export type AnswerKind = "yes" | "part" | "maybe" | "no";

export interface TimeAnswer {
  a: AnswerKind;
  /** Earliest the person can arrive, for a Partly answer. HH:MM. */
  from?: string;
  /** When they have to leave, for a Partly answer. HH:MM. */
  until?: string;
}

/** One candidate time on a plan. Everyone answers this time on its own. */
export interface TimeOption {
  id: ID;
  byId: ID;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  resp: Record<ID, TimeAnswer>;
}

/** A non-host asking to add a time after the event is already confirmed. */
export interface ChangeRequest {
  id: ID;
  byId: ID;
  date: string;
  time: string;
}

export type FeedKind =
  | "post"
  | "resp"
  | "nonall"
  | "suggest"
  | "confirm"
  | "autoconf"
  | "reopen"
  | "request"
  | "reqyes"
  | "reqno"
  | "join"
  | "drop"
  | "handoff"
  | "cancel"
  | "extend"
  | "comment"
  | "rate";

export interface FeedItem {
  id: ID;
  t: number; // epoch ms
  byId: ID;
  k: FeedKind;
  title?: string;
  opt?: string;
  ans?: string;
  why?: string;
  to?: string;
  text?: string;
  n?: number;
}

export interface Plan {
  id: ID;
  groupId: ID;
  title: string;
  where: string;
  note: string;
  placeId?: string;
  price: number | null;
  est: CostRange | null;
  /** Auto tag from what was typed, e.g. "dinner". Shown as #dinner. */
  tag?: string | null;
  /** Headcount the estimate assumed ("for five of us"). */
  people?: number;
  byId: ID; // who posted it
  hostId: ID; // who must be free, and who confirms
  createdAt: string; // ISO datetime posted; reset when voting reopens
  extMs: number; // extra voting time, added 12h at a time
  auto: boolean; // confirm the recommended time when voting closes
  pickId: string | null; // host's tie-break
  confirmedOptionId: string | null;
  /** Confirmed start. Later than the option time when people are only partly free. */
  start: string | null;
  goingIds: ID[];
  requests: ChangeRequest[];
  options: TimeOption[];
  confirmedAt?: string; // ISO datetime locked in, used for finalization-speed points
}

export interface Group {
  id: ID;
  name: string;
  region: string;
  hood: string;
  school?: string;
  createdAt: string; // YYYY-MM-DD
  memberIds: ID[];
  plan: Plan | null;
  /** Finished plans, kept so logs can reference their finalization speed. */
  pastPlans: Plan[];
  /** Plan updates everyone in the group sees, including across open windows. */
  feed: FeedItem[];
}

export interface State {
  version: number;
  users: User[];
  groups: Group[];
  logs: ActivityLog[];
}

export interface Competitor {
  name: string;
  size: number;
  hood: string;
  outings: number;
  pts: number;
}
