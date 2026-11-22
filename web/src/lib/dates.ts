export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAY_MS = 86_400_000;

export const parseD = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayISO = (now = new Date()) => iso(now);
export const daysAgo = (n: number, now = new Date()) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return iso(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseD(b).getTime() - parseD(a).getTime()) / DAY_MS);
export const fmtD = (
  s: string,
  o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" },
) => parseD(s).toLocaleDateString("en-US", o);
export const fmtT = (t: string) => {
  if (!t) return "";
  const [h0, m] = t.split(":").map(Number);
  const ap = h0 >= 12 ? "PM" : "AM";
  const h = h0 % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
};
export const nextFriday = (now = new Date()) => {
  const d = new Date(now);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return iso(d);
};
export const monthKey = (s: string) => s.slice(0, 7);
