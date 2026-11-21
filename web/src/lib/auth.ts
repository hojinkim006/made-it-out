import type { User } from "./types";

/**
 * Demo-only auth. Accounts live in the browser's localStorage, so this is NOT
 * secure: swap for a real backend (Supabase/Firebase auth) before launch.
 */
export async function hashPassword(username: string, password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${username.toLowerCase()}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const digits = (s: string) => s.replace(/\D/g, "");

/** Find a user by email, username or phone number. */
export function findUser(users: User[], identifier: string): User | undefined {
  const id = identifier.trim().toLowerCase().replace(/^@/, "");
  if (!id) return undefined;
  const phone = digits(id);
  return users.find(
    (u) =>
      u.email.toLowerCase() === id ||
      u.username.toLowerCase() === id ||
      (phone.length >= 7 && digits(u.phone).endsWith(phone.slice(-10))),
  );
}

export async function login(users: User[], identifier: string, password: string): Promise<User | null> {
  const user = findUser(users, identifier);
  if (!user) return null;
  return (await hashPassword(user.username, password)) === user.passHash ? user : null;
}

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export interface SignUpInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
  phone: string;
  region: string;
}

export function validateSignUp(users: User[], f: SignUpInput): Partial<Record<keyof SignUpInput, string>> {
  const e: Partial<Record<keyof SignUpInput, string>> = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = "Enter a valid email";
  else if (users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) e.email = "Email already has an account";
  const un = f.username.toLowerCase();
  if (!USERNAME_RE.test(un)) e.username = "3–20 letters, numbers, _ or .";
  else if (users.some((u) => u.username.toLowerCase() === un)) e.username = "Username is taken";
  if (f.password.length < 6) e.password = "At least 6 characters";
  if (!f.displayName.trim()) e.displayName = "Add your name";
  if (digits(f.phone).length < 10) e.phone = "Enter a 10-digit phone number";
  else if (users.some((u) => digits(u.phone) === digits(f.phone))) e.phone = "Phone already has an account";
  if (!f.region) e.region = "Pick a region";
  return e;
}

/** University verification by .edu email. Demo: no code is actually sent. */
export const SCHOOLS: Record<string, string> = {
  "bu.edu": "Boston University",
  "mit.edu": "MIT",
  "harvard.edu": "Harvard University",
  "northeastern.edu": "Northeastern University",
  "tufts.edu": "Tufts University",
  "bc.edu": "Boston College",
  "emerson.edu": "Emerson College",
  "suffolk.edu": "Suffolk University",
};

export function schoolForEmail(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const match = Object.keys(SCHOOLS).find((d) => domain === d || domain.endsWith("." + d));
  return match ? SCHOOLS[match] : null;
}

export const REGIONS = ["Boston, MA", "Cambridge, MA", "Somerville, MA", "Brookline, MA", "New York, NY", "Providence, RI"];
