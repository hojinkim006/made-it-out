import { useState, type FormEvent } from "react";
import { useStore, uid } from "../store";
import { hashPassword, login, REGIONS, schoolForEmail, validateSignUp, type SignUpInput } from "../lib/auth";
import { Icon } from "../components/Icons";
import { Seg } from "../components/Sheet";
import { Tree } from "../components/Tree";
import { groupHealth } from "../lib/scoring";

export function AuthPage() {
  const { state } = useStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const showcase = state.groups[0];
  const logs = state.logs.filter((l) => l.groupId === showcase?.id);

  return (
    <div className="auth">
      <section className="card auth-hero">
        <div className="eyebrow">Less group chat. More good stories.</div>
        <h1>make it out.</h1>
        <p className="sub">Plan hangouts in one place, log what you did, and watch your group's tree grow.</p>
        {showcase && (
          <div className="gprev">
            <Tree logs={logs} stage="Full canopy" health={groupHealth(logs.map((l) => l.date))} mini />
          </div>
        )}
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
        {mode === "login" ? <Login /> : <SignUp />}
      </section>
    </div>
  );
}

function Login() {
  const { state, signIn } = useStore();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const user = await login(state.users, id, pw);
    setBusy(false);
    if (!user) return setErr("That email, username or phone and password don't match.");
    signIn(user.id);
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
        Log in <Icon name="arrow" />
      </button>
      <p className="hint" style={{ marginTop: 18 }}>
        Demo accounts (passwords are in the project overview):
      </p>
      <div className="demo-users">
        {state.users.map((u) => (
          <button type="button" key={u.id} className="chip" onClick={() => setId(u.username)}>
            @{u.username}
          </button>
        ))}
      </div>
    </form>
  );
}

function SignUp() {
  const { state, update, signIn, toast } = useStore();
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
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = { ...validateSignUp(state.users, f) };
    const school = f.schoolEmail ? schoolForEmail(f.schoolEmail) : null;
    if (f.schoolEmail && !school) v.schoolEmail = "Use a supported university email (e.g. @bu.edu)";
    setErrs(v);
    if (Object.keys(v).length) return;
    const id = uid();
    const username = f.username.toLowerCase();
    const passHash = await hashPassword(username, f.password);
    update((s) => {
      s.users.push({
        id,
        username,
        email: f.email.trim(),
        phone: f.phone.trim(),
        passHash,
        displayName: f.displayName.trim(),
        region: f.region,
        school: school ?? undefined,
        schoolEmail: school ? f.schoolEmail.trim() : undefined,
        friendIds: [],
      });
    });
    signIn(id);
    toast(`Welcome, ${f.displayName.trim()}! Add friends by username to start a group.`);
  };

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
      <button className="btn btn-primary block">
        Create account <Icon name="arrow" />
      </button>
    </form>
  );
}
