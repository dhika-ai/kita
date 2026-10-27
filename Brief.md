# KITA — Product Brief

_Last updated: 2026-10-27 (feature triage, brainstorm 26–27 Oct) · Owner: Dhika_

> **One sentence:** KITA is a household management app that raises family members' engagement with, and awareness of, household chores.

Full product and technical plan: [KITA — Product & Technical Plan](https://claude.ai/artifact/FH6AL2vg9zFyofzJAWiPAi)

---

## 1. Problem

Family members often forget, or do not know, their duties toward the household because of busy schedules.

In Dhika's words: it is hard to remember which chores to do today, what my wife wants help with and how to do it, and to make the children enjoy helping at home so they build life skills.

- **Target:** KITA becomes the family's one-stop hub and second brain for chores and finances, with moments shared voluntarily, all in one app so it also nudges family habits.
- **Minimum success:** Dhika finishes his tasks in the expected number, time and quality.
- **Anchor:** every member opens KITA and finishes their tasks every day.
- **Gamification principles:** accountability, clarity, effort earns privileges, not hyper-competitive.

## 2. Users

Father, mother and 2 children (aged 6–17), all on Android phones. The youngest uses a parent's phone.

| Role   | Notes                                               |
| ------ | --------------------------------------------------- |
| Father | Family head and account owner; registers the family |
| Mother | Same admin rights as father                         |
| Child  | Own tasks and personal habits                       |

The domestic assistant (ART) role is on hold (Review): it is not part of the problem statement.

## 3. Key decisions

| Area      | Decision                                                                                                                                                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform  | Responsive web app for laptop and phone, installable as a PWA. Offline-first: works with no signal and syncs when back online.                                                                                                                                                                                 |
| Accounts  | Father registers the family (max 5 users). No Google login.                                                                                                                                                                                                                                                    |
| Sign-in   | Parents use email + password. A child can use a simple 4–6 digit PIN on a device a parent has already signed in.                                                                                                                                                                                               |
| Language  | English and Bahasa Indonesia with a per-user switch.                                                                                                                                                                                                                                                           |
| Task flow | Immediate feedback: points are added as soon as a task is ticked done. Parents do random checks and can undo a tick, which takes the points back. No end-of-day approval and no photo proof required.                                                                                                          |
| Points    | Point weight per task is set by parents in master data. Points are redeemable for rewards that parents define, including privileges (e.g. game-console time). Progress is personal, against daily, weekly and monthly targets; there is no leaderboard.                                                        |
| Reminders | PWA push notifications at 07:00 and 17:00 (WIB). A parent's phone can also receive the youngest child's reminders.                                                                                                                                                                                             |
| Finance   | Parents only. Income and expenses in Rupiah from imported e-statements (PDF/CSV) with automatic category rules, plus manual entry for cash. Income and expense posts are set in master data. A budget per expense post with over-budget flagging. Sources: BCA, BNI, Mandiri, blu, GoPay. No bank integration. |
| Moments   | Journals and photos visible to parents and children. Photos are compressed on the phone, with a storage indicator.                                                                                                                                                                                             |
| Backup    | Parents can download a backup (all data and photos as a ZIP) and restore it.                                                                                                                                                                                                                                   |
| Hosting   | Free tiers only: Vercel (hosting) and Supabase (database, auth, storage, scheduler).                                                                                                                                                                                                                           |

## 4. Core features

1. **Login & registration**
   - The father registers the family (father, mother, 2 children).
   - Email + password for parents; PIN for children.

2. **Task tracker & assignment**
   - Assign by role and by work area (kitchen, bathroom, laundry room, etc.).
   - Household tasks on daily, weekly and monthly schedules: cleaning, laundry, maintenance, inventory/groceries, cooking.
   - Individual habits and obligations (e.g. school tasks, gym), which parents and children can set.
   - Each task can show step-by-step instructions (SOP), written by the parents over time, with optional photos per step.
   - Immediate feedback: points on tick, random checks by parents.

3. **Inventory**
   - Stock is updated through a routine stock-take task on the 25th of every month.
   - Routine shopping tasks and a shared shopping list.

4. **Personal progress & rewards**
   - Dashboard with each member's progress against daily, weekly and monthly targets.
   - Points and a rewards catalogue, including privileges (children request, parents grant).

5. **Daily Message from Dad/Mum**
   - A value or focus for today, with an optional photo, shown on the dashboard. If today has none, the latest message is shown.

6. **Push notification reminders**
   - **07:00**: yesterday's performance, the daily message, and what to do today.
   - **17:00**: what is still not completed today.

7. **Moments**
   - Daily uploads of photos and writing / journalling, compressed on the phone, with a storage indicator.
   - Moment of the Week and Moment of the Month.

8. **Financial tracker** (father and mother only)
   - Import e-statements (PDF/CSV) from BCA, BNI, Mandiri, blu and GoPay, with automatic category rules (e.g. "INDOMARET → Kitchen groceries").
   - Manual entry for cash transactions.
   - Budget per expense post, with a flag when a post goes over budget.

9. **Master data** (editable by parents)
   - SOPs / instructions, categories, work areas.
   - Task and inventory lists, chore types (routine, periodic, ad-hoc).
   - Point weights per task, rewards, income and expense posts, accounts, automatic category rules.

10. **Backup & restore** (father and mother only)
    - Download all family data and photos as a ZIP, and restore from it.

**On hold (Review):** ART role, badges, calendar, receipt OCR, report generator (PDF and CSV).
**Dropped:** leaderboard, quote of the day, end-of-day approval, Telegram.

## 5. Roles & access

| Capability                               | Father           | Mother           | Child                        |
| ---------------------------------------- | ---------------- | ---------------- | ---------------------------- |
| Register family, invite / remove members | Yes              | No               | No                           |
| Sign in                                  | Email + password | Email + password | PIN (or email)               |
| Edit master data                         | Yes              | Yes              | No                           |
| Create and assign tasks                  | Anyone           | Anyone           | Self only (personal habits)  |
| Tick a task done                         | Yes              | Yes              | Own                          |
| Undo a tick (random check)               | Yes              | Yes              | No                           |
| Dashboard (personal progress)            | Yes              | Yes              | Yes                          |
| Redeem points for rewards                | Yes              | Yes              | Request                      |
| Moments (photos, journals)               | Read + write     | Read + write     | Read + write                 |
| Finance tracker                          | Full             | Full             | No access                    |
| Backup & restore                         | Yes              | Yes              | No                           |
| Push notification reminders              | Yes              | Yes              | Yes (or on a parent's phone) |

Finance access is enforced in the database (row-level security), not only hidden in the UI.

## 6. Release order

| #   | Release                                                                                      | Brief DoD covered |
| --- | -------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Task Tracker + master data (incl. registration, login, EN/ID, offline sync, basic dashboard) | 1, 2              |
| 2   | Push notification reminders                                                                  | 5                 |
| 3   | Moments & Daily Message                                                                      | 3                 |
| 4   | Gamification without leaderboard (points on tick, personal progress, rewards)                | 2                 |
| 5   | Finance + backup & restore                                                                   | 4, 6              |

Releases 0–5 were first built with Telegram, quotes and a leaderboard; the build plan tracks the changes from this triage as follow-up tasks.

Each release is used by the family for about a week before the next one starts.

## 7. Non-goals

1. No integration with any bank account (e-statement files are imported instead).
2. No auto-login with Google.

## 8. Definition of Done

1. The task tracker can be filled in and uses the right categories from master data.
2. The achievement dashboard shows accurate numbers that match the task tracker.
3. The Daily Message from Dad/Mum appears on the dashboard.
4. The financial tracker can be viewed by the father and mother roles only.
5. Reminders are sent to the users as push notifications.
6. A backup can be downloaded and restored.

## 9. Assumptions

These were proposed in the plan and ticked as confirmed there:

- ~~Unreviewed ticks are never auto-approved~~ and ~~the day closes at 21:00 WIB as the approval cutoff~~: dropped with the end-of-day approval (triage 27 Oct).
- A child may create their own personal-habit tasks but not household chores.
- All family members are on WIB (Asia/Jakarta).
- Coding is on hold until Dhika gives the signal.
