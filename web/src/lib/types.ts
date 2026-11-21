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
  points: PointBreakdown;
}

export interface Suggestion {
  id: ID;
  byId: ID;
  date: string;
  time: string;
  voterIds: ID[];
}

export interface Plan {
  id: ID;
  groupId: ID;
  title: string;
  where: string;
  date: string;
  time: string; // HH:MM
  note: string;
  placeId?: string;
  byId: ID;
  createdAt: string; // ISO datetime posted
  confirmedAt?: string; // ISO datetime locked in
  inIds: ID[]; // accepted current time
  outIds: ID[]; // can't make it
  suggestions: Suggestion[];
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
