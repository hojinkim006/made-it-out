import type { User } from "./types";

/** Sign-up and profile rules. Accounts and passwords live in Supabase Auth. */

export const digits = (s: string) => s.replace(/\D/g, "");

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

/** University verification by .edu email domain. No code is sent yet. */
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
