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
- **The Side Questers** (Hojin, David, Andrew, Matt): 13 logs, 5-week streak, thriving. Use this for the 4-screen demo.
- **Study Breakers** (David, John, Andrew): last log 20 days ago, so it's wilting. Has an open plan with a suggested time (shows the Votes tab).
- **Night Owls** (Hojin, Matt): a duo, so it's on the Duos board.

## 4-screen script
Open 4 browser windows at http://localhost:5173 (side by side) and log in as Hojin, David, Andrew, Matt.

1. **User 1 (David)**: Your groups → The Side Questers → Plan a hangout → "Dinner @ ___ @ 5pm" → Share. The other three get a notification and see it under **Votes**.
2. **User 2 (Andrew)**: Votes → **Accept**.
3. **User 3 (Matt)**: does nothing, shown as "Hasn't answered".
4. **User 4 (Hojin)**: **Suggest a time** → pick a new time → Send. Everyone sees the new option and can vote.
5. Back to David: **Use this time** or **Lock it in**, then **Log this hangout** to show points (speed bonus), the new fruit, and the leaderboard move.
