# XR Jags team tasks + member management

Status (2026-10-24): built and tested locally only. Nothing is applied, deployed, committed or pushed.

## How it works (plain words)

- **My tasks**: everyone sees the tasks they are on, grouped as To do, Working on it, Ready for review and Done. Big buttons move a task along (Start, Ready for review, Mark done). Each card has its checklist, its due date (red when overdue) and a "Post an update" box. "Add a task for me" makes a personal task.
- **Team tasks** (managers only): a board with the same four columns, a "Person" filter, a Table view (person, open, overdue, waiting review, done this week) and a "Give a task" form (title, details, people, due date, priority, checklist lines).
- **Task window**: opens from any task title. It shows details, people, checklist, updates, history, and Delete (the maker or a manager only, and a reason is required). Every window and sub-page has a "Back to ..." link.
- **Updates bell**: shows the unread count and checks every 30 seconds. Clicking a note opens the task. People get a note when they are given a task, when someone posts an update or moves a task they are on, and managers get one when a task reaches Ready for review or Done.
- **Team** (managers only): lists everyone with role and access. "Add member" makes the login and shows a temporary password once, with a Copy button and this note: "Give this to them in person or by text; they will pick their own password at first sign-in." Managers can also Reset password, Turn off access / Turn on access, and change roles. Only an admin can make, change or turn off an admin. Nobody can turn off or demote themselves.
- **Deleted** (managers only): deleted tasks with who, when and why, plus a Restore button.
- **First sign-in**: anyone whose `must_change_password` is set sees only "Pick your own password" until they save a new one (10+ characters, must differ from the temporary one). Every password box has a Show password button.
- **Siloed**: the database enforces this, not the page. Members only see tasks they are on or made. People handed a task can change its status, tick checklist steps and post updates, but cannot edit its wording, change who is on it, or delete it. Turning access off hides everything at once, including leads.
- If the tables do not exist yet, the task tabs say "Task list is being set up", and Leads, Activity log and Uploads keep working.

## Files

| File | What it is |
|---|---|
| `su-shared/migration-tasks.sql` | Block 3: staff columns, tasks, task_members, task_checklist, task_updates, task_activity, notifications, rules, triggers, RPCs, indexes. Safe to run twice. |
| `su-shared/functions/admin-members/index.ts` | Edge Function for create / reset / deactivate / reactivate / role. |
| `caav-website/dashboard/index.html` | New sections: password screen, tab bar, bell, My tasks, Team tasks, Team, Deleted, task window. |
| `caav-website/assets/tasks.js` | All the task and member screens (new). |
| `caav-website/assets/dashboard.js` | Small hook: runs tasks.js before showing the dashboard (5 lines). |
| `caav-website/assets/site.css` | New "team tasks" style block at the end, plus a phone fix so wide tables scroll inside their box. |

## Deploy steps (in this order, after Sonny's OK)

1. **Apply the SQL.** In the Supabase dashboard for project southern-xr-jags (ykdyzsoukftzyfxfchoe), go to SQL Editor, paste all of `su-shared/migration-tasks.sql`, and run it. Block 1 must already be in place, and it is. Block 2 (uploads) is independent.
   - Existing staff rows get `must_change_password = false`, so people who already sign in are not forced to change. New rows default to `true`.
   - `private.is_staff()` now also requires `active = true`. This applies to leads, activity_log and uploads too.
2. **Deploy the function.** From the `su-shared` folder: `supabase functions deploy admin-members --project-ref ykdyzsoukftzyfxfchoe`. Leave JWT verification on (the default). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically, so no secrets need setting. Supabase expects the function at `supabase/functions/admin-members/index.ts`, so copy the folder there if the CLI cannot find it.
3. **Make Lynelle the admin.** Her login must exist first (Authentication > Users). Then run this in the SQL Editor with her real email:
   ```sql
   insert into public.staff (user_id, full_name, role, email, active, must_change_password)
   select id, 'Lynelle', 'admin', email, true, false from auth.users where lower(email) = lower('HER_EMAIL')
   on conflict (user_id) do update set role = 'admin', active = true, email = excluded.email;
   ```
   Also fill `email` for existing staff rows so the Team tab shows it: `update public.staff s set email = u.email from auth.users u where u.id = s.user_id and s.email is null;`
4. **Ship the site files** (pre-commit audit first, then push): `dashboard/index.html`, `assets/tasks.js`, `assets/dashboard.js`, `assets/site.css`.
5. **Live check:** Lynelle signs in, adds a test member, signs in as that member in a private window, picks a password, gets a task, posts an update, then the test member is turned off.

## What was tested

- **SQL**: run twice in a local Postgres 16 with a small Supabase stand-in (auth.uid(), anon/authenticated roles, auth and storage schemas). 50 rule checks passed, covering: a member sees only their own tasks; a member cannot edit wording, delete others' tasks, assign people, reword checklists, or restore; the maker can delete with a reason; managers see Deleted and can restore; history and notifications are written by triggers; inactive staff see nothing; the password-flag RPC clears only the caller's own flag; anon gets nothing.
- **Page**: Python Playwright with a mock Supabase client, at 1280 and 390 px. 139 checks passed, with no console errors and no sideways scroll on any tab. The checks follow the brief's list and also include filter, table view, edit, add person and step, bell, copy, reset, turn off/on, role, the hover cards (name/title only), 44px targets, and "being set up".
- **Edge function**: passes `deno check`. The temporary password generator was checked on 5,000 samples: right format, no look-alike characters, all unique.

## Not verified

- Nothing ran against the real Supabase project. The live auth calls (`auth.admin.createUser`, `updateUserById` with `ban_duration`, `auth.updateUser`) were not run.
- The edge function was never served: Deno's server crashes in this sandbox, so its CORS and sign-in checks were reviewed by reading the code, not by a live call.
- The page tests use a mock that copies the SQL rules by hand. The real API could differ in small ways, for example error codes and the exact `functions.invoke` error shape.
- Real phones (Safari/iOS), screen readers, and the clipboard on plain http were not tried.

## Known limits

- A person with the forced-password flag could in theory clear their own flag through the RPC without changing their password. They would then keep the temporary password a manager has seen. It only affects their own account.
- Every active staff member can read the staff list, including emails (this was already the Block 1 rule).
- Resetting a password does not sign out sessions that are already open. The old password stops working for new sign-ins.

---

# Partners tab (Block 4)

Status (2026-10-24): built and tested locally only. Nothing is applied, deployed, committed or pushed.

## How it works (plain words)

- **Partners** is a new dashboard tab that everyone on the team can see. It tracks what each partner offered, what they actually delivered, and the dates (offered and deployed).
- **Summary row**: number of partners split by kind (Resource partner, Sponsor, Program partner), NDA signed (for example "2 of 4"), resources deployed, and value delivered (the dollar value added up from resources marked Deployed).
- **List**: each partner shows its kind plus NDA and MOU chips, with counts for resources, deployed, and dollars delivered. Filters: Kind, and "NDA not signed yet". Hovering only the partner's **name** shows a card with kind, NDA, MOU, other agreement, resource count, value delivered, and a ring picture of deployed out of offered. Clicking the name opens the partner's own page (`#partners/p/<id>`, which also works as a direct link).
- **Partner page**: about (contact, notes), paperwork (NDA status and signed-on date, MOU status and signed-on date, an optional other agreement with its status), and a resources timeline from oldest to newest (offered date, then deployed date, then a status chip: Offered, Confirmed, Deployed or Declined). When the NDA is not signed, the page shows: "Sign the NDA before sharing plans or budgets." Choosing Signed with no date fills in today's date (the database does this too).
- **Who can do what** (the database enforces this; the page only hides buttons): all active staff can read. Managers (admin, leadership) and student leads can add partners, add resources, change paperwork and update resources. Only managers can remove a resource or a partner, and removing a partner also removes its resources. Students can only read. Visitors get nothing.
- Every box and summary tile has a "?" help button. The Add partner screen and the partner page each have "Back to Partners", which keeps the filters you had set.
- If the tables are not there yet, the tab says "Partners list is being set up" and every other tab keeps working.

## Files

| File | What it is |
|---|---|
| `su-shared/migration-partners.sql` | Block 4: `private.can_edit_partners()`, tables `partners` and `partner_resources`, triggers (created_by, updated_at, signed-on dates), rules, indexes. |
| `caav-website/assets/partners.js` | All of the Partners screens (new). |
| `caav-website/dashboard/index.html` | Partners tab link, the `#t-partners` section, Add partner form, script tag. |
| `caav-website/assets/tasks.js` | Small hooks: Partners added to the tab list and routes; starts and stops partners.js. |
| `caav-website/assets/site.css` | New "Partners tab" style block at the end. |

## Deploy steps (in this order, after Sonny's OK)

1. **Apply the SQL.** Blocks 1, 2 and 3 are already live. In the Supabase dashboard for southern-xr-jags (ykdyzsoukftzyfxfchoe), open SQL Editor, paste all of `su-shared/migration-partners.sql`, and run it once.
   - The file has no `drop` statements, so the apply tool should not cancel anything. Policies are only created when they do not exist yet, and triggers use `create or replace trigger`.
   - Running it a second time is safe: nothing changes and nothing fails. But a later edit to a policy in this file would **not** replace the live policy. That needs its own new block.
   - Afterwards check: Table Editor shows `partners` and `partner_resources` with RLS on, and Database > Policies shows 8 policies for them.
2. **Ship the site files** (pre-commit audit first, then push): `dashboard/index.html`, `assets/partners.js`, `assets/tasks.js`, `assets/site.css`.
3. **Live check:** a manager adds a test partner and a resource, a student lead changes the NDA to Signed, a student opens the tab and sees no edit buttons, then the manager removes the test partner.

## What was tested

- **SQL**: local Postgres 16 with the Supabase stand-in, after Block 1, uploads and Block 3 (with the Block 3 rule test). 45 rule checks passed, twice: (a) apply, test, apply again, clear the data, test again; (b) apply twice on a fresh copy, then test. Both runs ended with 8 policies and 2 triggers, and the file has no drop statements. The checks cover: every value check; an admin, a leadership member and a student lead can add and change; the lead cannot remove; a student can only read (changes and removals do nothing); inactive and non-staff accounts see nothing; anon is refused; created_by cannot be faked or changed; a resource cannot be moved to another partner; signed-on dates fill in; a deployed date before the offered date is refused; removing a partner removes its resources; the functions are security definer with a pinned search_path.
- **Page**: Python Playwright with a mock Supabase client, at 1280 and 390 px. 121 checks passed with no console errors and no sideways scroll. They cover: summary numbers, NDA and MOU chips, the kind filter, the "NDA not signed yet" filter, the hover card appearing only on the name, clicking a name to open the partner, the NDA warning, the timeline, adding a partner, adding a resource (with plain-word date checks), changing the NDA/MOU/other agreement, updating a resource, read-only for students, no remove for leads, remove for managers, the "?" on every box, Back to Partners keeping filters, 44px targets, and "being set up". The existing `test_tasks.py` still passes all 139 checks.

## Not verified

- Nothing ran against the real Supabase project. The live PostgREST error codes and the RLS behaviour were not checked against it.
- The page tests use a mock that copies the SQL rules by hand.
- Real phones (Safari/iOS) and screen readers were not tried.
- `create or replace trigger` needs Postgres 14 or newer. Supabase projects are 15+, but the live version was not checked.
