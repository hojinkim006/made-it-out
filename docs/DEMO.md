# Demo guide

```bash
cd web && npm install && npm run dev
```

## How "live" works without a backend
All app data lives in the browser's `localStorage`. Every window of the app on the **same computer and browser** updates instantly (via the `storage` event), and each window keeps its own signed-in user. That's what powers the 4-screen demo. To sync across different devices, swap `web/src/store.tsx` for a real backend (e.g. Supabase realtime).

**Reset demo** (footer) restores the seed data in every open window.

## Accounts
| Name | Username | Email |
|---|---|---|
| Hojin | `hojinnyneutron` | hojiniscool@gmail.com |
| David | `vidsteriscool` | vidster@bu.edu (verified BU) |
| Andrew | `machoman` | sunny1208@gmail.com |
| Matt | `mattishere` | mattishere@gmail.com |
| John | `itsmejohn` | johnuniversity@gmail.com |

Passwords are in the project overview doc; the repo only stores hashes. Log in with email, username or phone.

## Seed groups
- **The Side Questers** (Hojin, David, Andrew, Matt): 13 logs, thriving, and an open Friendsgiving plan. Andrew is the host. Friday already has enough people (Andrew yes, Matt yes, David partly after 6:30). Saturday is David's other time. Hojin hasn't answered. Use this for the 4-screen demo.
- **Study Breakers** (David, John, Andrew): last log 20 days ago, so it's wilting.
- **Night Owls** (Hojin, Matt): a duo, so it's on the Duos board.

## 4-screen script
Open 4 browser windows at http://localhost:5173 (side by side) and log in as Hojin, David, Andrew, Matt.

1. **Everyone**: Your groups → The Side Questers → **Votes**. Friday is recommended: the host is free and 3 of 4 can come. David's "Partly" offers to start at 6:30 so the times overlap.
2. **Hojin**: answer **Yes** on Friday (or **Partly** and set a window).
3. **Andrew (host)**: **Confirm…**, keep the later start so David overlaps, and confirm. A time the host can't make, or that fewer than 3 people can attend, stays unconfirmed.
4. **David**: **Log it** to show points (speed bonus from how fast it was confirmed), the new fruit, and the leaderboard move.

Posting a new event replaces this plan. The host's Yes is recorded on each time they offer. Voting closes after 24 hours, or 2 hours before the earliest time. Turn on auto-confirm and the recommended time locks itself in at that deadline.
