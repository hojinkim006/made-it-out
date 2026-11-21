import { useState } from "react";
import { useStore } from "../store";
import { digits, hashPassword, REGIONS, schoolForEmail } from "../lib/auth";
import { Sheet } from "../components/Sheet";
import { Icon } from "../components/Icons";

export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { me, state, update, toast } = useStore();
  const [name, setName] = useState(me!.displayName);
  const [email, setEmail] = useState(me!.email);
  const [phone, setPhone] = useState(me!.phone);
  const [err, setErr] = useState("");

  const save = () => {
    const others = state.users.filter((u) => u.id !== me!.id);
    if (!name.trim()) return setErr("Add your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Enter a valid email");
    if (others.some((u) => u.email.toLowerCase() === email.toLowerCase())) return setErr("That email is already in use");
    if (digits(phone).length < 10) return setErr("Enter a 10-digit phone number");
    if (others.some((u) => digits(u.phone) === digits(phone))) return setErr("That phone is already in use");
    update((s) => {
      const u = s.users.find((x) => x.id === me!.id)!;
      u.displayName = name.trim();
      u.email = email.trim();
      u.phone = phone.trim();
    });
    toast("Profile updated");
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <span className="ico">
          <Icon name="edit" />
        </span>
        <h2>Edit profile</h2>
        <p className="meta">@{me!.username} · usernames can't be changed</p>
      </div>
      <label className="f">
        <span>Display name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="f">
        <span>Email</span>
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="f">
        <span>Phone number</span>
        <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {err && <span className="err-text">{err}</span>}
      </label>
      <button className="btn btn-primary block" onClick={save}>
        Save changes
      </button>
    </Sheet>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { me, update, toast, signOut } = useStore();
  const [region, setRegion] = useState(me!.region);
  const [schoolEmail, setSchoolEmail] = useState(me!.schoolEmail ?? "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState("");

  const saveRegion = (r: string) => {
    setRegion(r);
    update((s) => {
      s.users.find((u) => u.id === me!.id)!.region = r;
    });
    toast(`Leaderboard region set to ${r}`);
  };

  const verify = () => {
    const school = schoolForEmail(schoolEmail);
    if (!school) return setErr("Use a supported university email, e.g. you@bu.edu");
    setErr("");
    update((s) => {
      const u = s.users.find((x) => x.id === me!.id)!;
      u.school = school;
      u.schoolEmail = schoolEmail.trim();
    });
    toast(`Verified: ${school}`);
  };

  const changePw = async () => {
    if ((await hashPassword(me!.username, cur)) !== me!.passHash) return setErr("Current password is wrong");
    if (next.length < 6) return setErr("New password needs at least 6 characters");
    const h = await hashPassword(me!.username, next);
    update((s) => {
      s.users.find((u) => u.id === me!.id)!.passHash = h;
    });
    setCur("");
    setNext("");
    setErr("");
    toast("Password changed");
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-hero">
        <span className="ico">
          <Icon name="gear" />
        </span>
        <h2>Settings</h2>
      </div>
      <label className="f">
        <span>Region <em>which local leaderboard you're on</em></span>
        <select className="field" value={region} onChange={(e) => saveRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <div className="f">
        <span>
          University verification{" "}
          {me!.school ? <span className="badge green">Verified · {me!.school}</span> : <span className="badge soft">Not verified</span>}
        </span>
        <div className="copy-row" style={{ margin: 0 }}>
          <input className="field" placeholder="you@bu.edu" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} />
          <button className="btn btn-secondary" onClick={verify}>
            Verify
          </button>
        </div>
        <p className="hint">Demo: verifies by email domain, no code is sent. Unlocks your school's sub-leaderboard.</p>
      </div>
      <div className="f">
        <span>Change password</span>
        <div className="f2">
          <input className="field" type="password" placeholder="Current" value={cur} onChange={(e) => setCur(e.target.value)} />
          <input className="field" type="password" placeholder="New" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <button className="btn btn-soft sm mt" onClick={changePw}>
          Update password
        </button>
      </div>
      {err && <p className="err-text">{err}</p>}
      <div className="sheet-nav">
        <button className="btn btn-secondary sm" onClick={() => (signOut(), onClose())}>
          <Icon name="out" /> Sign out
        </button>
        <button className="btn btn-primary sm" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
