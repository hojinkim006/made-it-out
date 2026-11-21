export type ID = string;

export interface User {
  id: ID;
  name: string;
  school?: string;
  groupIds: ID[];
}

export interface Group {
  id: ID;
  name: string;
  location: string;
  school?: string;
  memberIds: ID[];
  createdAt: string; // ISO date
}

export interface ActivityLog {
  id: ID;
  groupId: ID;
  placeName: string;
  category: string; // matches keys in nicheness data, e.g. "axe throwing"
  date: string; // ISO date
  attendeeIds: ID[];
  emoji: string; // shown as fruit on the group tree
}

export type VoteChoice = "yes" | "no" | "alt";

export interface Vote {
  userId: ID;
  choice: VoteChoice;
  altTime?: string; // ISO datetime, when choice === "alt"
}

export interface EventProposal {
  id: ID;
  groupId: ID;
  title: string;
  place: string;
  proposedTime: string; // ISO datetime of the hangout
  createdAt: string; // ISO datetime the proposal was posted
  confirmedAt?: string;
  status: "open" | "confirmed" | "cancelled";
  votes: Vote[];
}

/** category -> nicheness in [0, 1], produced by pipeline/ */
export type NichenessTable = Record<string, number>;
