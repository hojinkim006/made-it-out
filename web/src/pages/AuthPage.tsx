import { useMemo, useState, type FormEvent } from "react";
import { useStore } from "../store";
import { supabase } from "../supabase";
import { errorText } from "../db";
import { REGIONS, schoolForEmail, validateSignUp, type SignUpInput } from "../lib/auth";
import { Icon } from "../components/Icons";
import { Seg } from "../components/Sheet";
import { Tree } from "../components/Tree";
import { groupHealth } from "../lib/scoring";
import { seed } from "../data/seed";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  // A sample tree for the welcome card. Real data needs an account.
  const sample = useMemo(() => {
    const s = seed();
    return s.logs.filter((l) => l.groupId === s.groups[0]?.id);
  }, []);

  return (
    <div className="auth">
      <section className="card auth-hero">
        <h1>made it out.</h1>
        <p className="sub">Plan hangouts in one place, log what you did, and watch your group's tree grow.</p>
        <div className="gprev">
          <Tree logs={sample} stage="Full canopy" health={groupHealth(sample.map((l) => l.date))} mini />
        </div>
      </section>
      <section className="card pad-lg form">
        <div style={{ marginBottom: 22 }}>
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { key: "login", label: "Log in" },
              { key: "signup", label: "Sign up" },
            ]}
          />
        </div>
        {mode === "login" ? <Login /> : <SignUp onDone={() => setMode("login")} />}
      </section>
    </div>
  );
}

function Login() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = "That email, username or phone and password don't match.";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setNote("");
    if (!id.trim() || !pw) return setErr("Enter your login and password");
    setBusy(true);
    try {
      let email = id.trim();
      if (!email.includes("@") || email.startsWith("@")) {
        // Username or phone: the database checks the password before revealing the email.
        const { data, error } = await supabase.rpc("login_email", { p_identifier: email, p_password: pw });
        if (error) return setErr(errorText(error));
        if (!data) return setErr(mismatch);
        email = data as string;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (/confirm/i.test(error.message)) return setErr("Confirm your email first. Check your inbox for the link.");
        if (/invalid login/i.test(error.message)) return setErr(mismatch);
        return setErr(error.message);
      }
      // The store notices the new session and loads your data.
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setErr("");
    const email = id.trim();
    if (!email.includes("@") || email.startsWith("@")) return setErr("Type your account email above, then tap Forgot password.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) return setErr(error.message);
    setNote(`If ${email} has an account, a reset link is on its way.`);
  };

  return (
    <form onSubmit={submit}>
      <h2>Welcome back.</h2>
      <label className="f">
        <span>Email, username or phone</span>
        <input className="field" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus />
      </label>
      <label className="f">
        <span>Password</span>
        <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        {err && <span className="err-text">{err}</span>}
      </label>
      <button className="btn btn-primary block" disabled={busy}>
        {busy ? "Logging in…" : "Log in"} <Icon name="arrow" />
      </button>
      <button type="button" className="btn btn-soft sm mt" onClick={forgot}>
        Forgot password
      </button>
      {note && <p className="hint" style={{ marginTop: 12 }}>{note}</p>}
    </form>
  );
}

function SignUp({ onDone }: { onDone: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState<SignUpInput & { schoolEmail: string }>({
    email: "",
    username: "",
    password: "",
    displayName: "",
    phone: "",
    region: "Boston, MA",
    schoolEmail: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Format checks here; uniqueness is checked by the database.
    const v: Record<string, string> = { ...validateSignUp([], f) };
    const school = f.schoolEmail ? schoolForEmail(f.schoolEmail) : null;
    if (f.schoolEmail && !school) v.schoolEmail = "Use a supported university email (e.g. @bu.edu)";
    setErrs(v);
    if (Object.keys(v).length) return;

    setBusy(true);
    try {
      const username = f.username.toLowerCase();
      const taken = await supabase.rpc("signup_conflicts", { p_username: username, p_phone: f.phone });
      if (taken.error) return setErrs({ email: errorText(taken.error) });
      const conflicts = (taken.data ?? []) as string[];
      if (conflicts.length) {
        return setErrs({
          ...(conflicts.includes("username") ? { username: "Username is taken" } : {}),
          ...(conflicts.includes("phone") ? { phone: "Phone already has an account" } : {}),
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username,
            display_name: f.displayName.trim(),
            phone: f.phone,
            region: f.region,
            school: school ?? "",
            school_email: school ? f.schoolEmail.trim() : "",
          },
        },
      });
      if (error) {
        if (/registered|exists/i.test(error.message)) return setErrs({ email: "Email already has an account" });
        if (/password/i.test(error.message)) return setErrs({ password: error.message });
        return setErrs({ email: error.message });
      }
      // With email confirmation on, an existing email comes back as a user with no identities.
      if (data.user && data.user.identities?.length === 0) return setErrs({ email: "Email already has an account" });
      if (data.session) {
        toast(`Welcome, ${f.displayName.trim()}! Add friends by username to start a group.`);
      } else {
        setSentTo(f.email.trim());
      }
    } finally {
      setBusy(false);
    }
  };

  if (sentTo)
    return (
      <div>
        <h2>Check your email.</h2>
        <p className="sub">
          We sent a confirmation link to <b>{sentTo}</b>. Open it, then log in here.
        </p>
        <button className="btn btn-primary block mt" onClick={onDone}>
          Go to log in <Icon name="arrow" />
        </button>
      </div>
    );

  const field = (k: keyof typeof f, label: string, type = "text", extra: Record<string, string> = {}) => (
    <label className="f">
      <span>{label}</span>
      <input className={`field${errs[k] ? " err" : ""}`} type={type} value={f[k]} onChange={set(k)} {...extra} />
      {errs[k] && <span className="err-text">{errs[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit}>
      <h2>Plant your first seed.</h2>
      {field("displayName", "Display name", "text", { autoComplete: "name" })}
      <div className="f2">
        {field("username", "Username", "text", { autoComplete: "username", placeholder: "lowercase, unique" })}
        {field("phone", "Phone number", "tel", { autoComplete: "tel" })}
      </div>
      {field("email", "Email", "email", { autoComplete: "email" })}
      {field("password", "Password", "password", { autoComplete: "new-password" })}
      <label className="f">
        <span>Region <em>for local leaderboards</em></span>
        <select className="field" value={f.region} onChange={set("region")}>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      {field("schoolEmail", "University email (optional, joins your school's board)", "email", { placeholder: "you@bu.edu" })}
      <button className="btn btn-primary block" disabled={busy}>
        {busy ? "Creating…" : "Create account"} <Icon name="arrow" />
      </button>
    </form>
  );
}
