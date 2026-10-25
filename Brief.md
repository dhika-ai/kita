# KITA — Product Brief

_Last updated: 2026-10-25 · Owner: Dhika_

> **One sentence:** KITA is a household management app that raises family members' engagement with, and awareness of, household chores.

Full product and technical plan: [KITA — Product & Technical Plan](https://claude.ai/artifact/FH6AL2vg9zFyofzJAWiPAi)

---

## 1. Problem

Family members often forget, or do not know, their duties toward the household because of busy schedules.

## 2. Users

A nuclear family of up to **5 members**:

| Role | Notes |
| --- | --- |
| Father | Family head and account owner; registers the family |
| Mother | Same admin rights as father |
| Child | Own tasks and personal habits |
| Domestic assistant (ART, optional) | Own tasks and household chores |

## 3. Key decisions

| Area | Decision |
| --- | --- |
| Platform | Responsive web app for laptop and phone, installable as a PWA. Offline-first: works with no signal and syncs when back online. |
| Accounts | Father registers the family (max 5 users). No Google login. |
| Sign-in | Parents use email + password. Child and ART can use a simple 4–6 digit PIN on a device a parent has already signed in. |
| Language | English and Bahasa Indonesia with a per-user switch, quotes included. |
| Task flow | Members tick tasks done; a parent approves at the end of the day; approved tasks count as progress from the next day. |
| Points | Point weight per task is set by parents in master data. Points are redeemable for rewards that parents define. |
| Reminders | Telegram bot at 07:00 and 17:00 (WIB). |
| Finance | Parents only. Income and expenses in Rupiah, a budget per expense post with over-budget flagging, and a record of which account/bank was used. No bank integration. |
| Moments | Journals and photos visible to parents and child only. ART sees the leaderboard but not Moments. |
| Hosting | Free tiers only: Vercel (hosting) and Supabase (database, auth, storage, scheduler). |

## 4. Core features

1. **Login & registration**
   - The father registers the family, up to 5 users.
   - Email + password for parents; PIN for designated members (child, ART).

2. **Achievement dashboard & gamification**
   - Dashboard with completion rates and points per member.
   - Leaderboard (weekly / monthly) and badges (e.g. streaks, area specialist).
   - Rewards catalogue: members redeem points (child and ART request, parents grant).
   - Calendar tracker with daily, weekly and monthly views, showing who assigned each task and to whom.

3. **Quote of the day**
   - A daily quote on one of the dashboard cards.
   - Themes: mindfulness, mental health, stoicism, productivity, Islam.
   - Available in English and Bahasa Indonesia; parents can edit or hide any quote.

4. **Task tracker & assignment**
   - Assign by role (father, mother, child, ART) and by work area (kitchen, bathroom, laundry room, etc.).
   - Household tasks and inventory on daily, weekly and monthly schedules: cleaning, laundry, maintenance, inventory/groceries, cooking.
   - Individual habits and obligations (e.g. school tasks, gym), which parents and children can set.
   - Each task can show detailed step-by-step instructions (SOP) on how to do it.
   - Inventory: when stock drops below its minimum, a restock task is created.

5. **Financial tracker** (father and mother only)
   - Track income and expenses in Rupiah.
   - Budget per expense post, with a flag when a post goes over budget.
   - Record which account / bank / e-wallet was used.

6. **Master data** (editable by parents)
   - SOPs / instructions, roles and access, categories, work areas.
   - Task and inventory lists, chore types (routine, periodic, ad-hoc).
   - Point weights per task, rewards, budget posts and accounts.

7. **Moments & reports**
   - Daily uploads of photos and writing / journalling.
   - Moment of the Week and Moment of the Month.
   - Report generator for tasks and finance, downloadable weekly / monthly (PDF and CSV).

8. **Reminders via Telegram**
   - **07:00** — yesterday's performance and what to do today.
   - **17:00** — what is still not completed today (parents also see how many tasks wait for their approval).

## 5. Roles & access

| Capability | Father | Mother | Child | ART |
| --- | --- | --- | --- | --- |
| Register family, invite / remove members | Yes | No | No | No |
| Sign in | Email + password | Email + password | PIN (or email) | PIN |
| Edit master data | Yes | Yes | No | No |
| Create and assign tasks | Anyone | Anyone | Self only (personal habits) | No |
| Tick a task done | Yes | Yes | Own | Own |
| Approve / reject at end of day | Yes | Yes | No | No |
| Dashboard and leaderboard | Yes | Yes | Yes | Yes |
| Redeem points for rewards | Yes | Yes | Request | Request |
| Moments (photos, journals) | Read + write | Read + write | Read + write | No access |
| Finance tracker and finance reports | Full | Full | No access | No access |
| Task reports | All members | All members | Own | Own |
| Telegram reminders | Yes | Yes | Yes | Yes |

Finance access is enforced in the database (row-level security), not only hidden in the UI.

## 6. Release order

| # | Release | Brief DoD covered |
| --- | --- | --- |
| 1 | Task Tracker + master data (incl. registration, login, EN/ID, offline sync, basic dashboard) | 1, 2 |
| 2 | Telegram reminders | 5 |
| 3 | Moments & Quotes | 3 |
| 4 | Gamification (leaderboard, badges, rewards, task reports) | 2 |
| 5 | Finance (incl. finance reports) | 4 |

Each release is used by the family for about a week before the next one starts.

## 7. Non-goals

1. No integration with any bank account.
2. No auto-login with Google.

## 8. Definition of Done

1. The task tracker can be filled in and uses the right categories from master data.
2. The achievement dashboard shows accurate numbers that match the task tracker.
3. A quote appears on one of the dashboard cards and updates daily.
4. The financial tracker can be viewed by the father and mother roles only.
5. Reminders are sent to the users.

## 9. Assumptions

These were proposed in the plan and ticked as confirmed there:

- Unreviewed ticks are never auto-approved; they stay pending and roll into the next review.
- The day closes at 21:00 WIB as the approval cutoff.
- ART sees the leaderboard but not Moments.
- A child may create their own personal-habit tasks but not household chores.
- All family members are on WIB (Asia/Jakarta).
- Coding is on hold until Dhika gives the signal.
