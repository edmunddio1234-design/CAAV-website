#!/usr/bin/env python3
"""Make seed-plan-tasks.sql (and a preview CSV) from the Foundations plan.

Plain words:
  * Reads the Foundations plan (assets/plan-data.js, assets/roles.js, assets/tracks-data.js), by running them with node.
  * One live task per plan item that is not done yet: title, details (with a link back to the plan item),
    due date where the plan has one, status, priority, and plan_item_id (the plan item's id, e.g. "c1-a4").
  * Items marked done in the plan are left out (they are not work to do).
  * People: the plan's named people for the item (its roles, names in its owner text, and the Track B / Track C
    detail in tracks-data.js). The SQL matches each name to an active login in public.staff by full name
    when it runs, so it uses whoever is on the staff list at that moment.
  * Anyone the SQL cannot match, and every item with "Owner not named yet" or only an organization as owner,
    goes to the admin: the staff login with email lynelle@missionmetrics.solutions.
  * Safe to run again: a plan item that already has a task is skipped ("on conflict (plan_item_id) do nothing").
    Needs Block 6 (migration-plan-link.sql) first.

Run:
  python3 seed-plan-tasks.py --plan "/path/to/Immersion-in-Motion-Strategy-Plan." [--base-url URL] [--staff staff.csv]
  --staff (optional): a CSV with full_name,email,active columns (an export of public.staff) to show in the preview
  exactly who each task will go to. Without it the preview shows the names and the rule.
Writes seed-plan-tasks.sql and seed-plan-tasks-preview.csv next to this script (or --out-dir).
Then paste seed-plan-tasks.sql into the Supabase SQL Editor (it runs as a privileged user). Only after Sonny's OK.
"""
import argparse, csv, datetime, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ADMIN_EMAIL = "lynelle@missionmetrics.solutions"
ADMIN_LABEL = "Lynelle Diolulu (admin)"
STATUS = {"urgent": ("todo", "high"), "open": ("todo", "normal"), "active": ("doing", "normal"), "parked": ("todo", "normal")}

NODE = r"""
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[1];
const noop = () => {};
const el = new Proxy(function () {}, { get: (t, k) => k === 'style' ? {} : el, apply: () => el, set: () => true });
const ctx = { window: {}, console, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el, body: el, addEventListener: noop },
  addEventListener: noop, localStorage: { getItem: () => null }, innerWidth: 1280, innerHeight: 800, setTimeout: noop, clearTimeout: noop };
vm.createContext(ctx);
for (const f of ['assets/plan-data.js', 'assets/roles.js', 'assets/tracks-data.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { if (!(f === 'assets/roles.js' && ctx.window.ROLES)) throw e; }  // roles.js draws its page after setting window.ROLES
}
const P = ctx.window.PLAN, R = ctx.window.ROLES, T = ctx.window.TRACKS_DATA;
if (!P || !R || !T) { console.error('plan data did not load'); process.exit(2); }
const acts = [];
P.components.forEach(c => c.objectives.forEach(o => o.activities.forEach(a => acts.push({ a, c: { code: c.code, id: c.id, name: c.name || c.title || '' }, o: { name: o.name } }))));
process.stdout.write(JSON.stringify({ acts, people: R.people, tracks: T, statuses: P.statuses, version: P.meta.version }));
"""


def load(plan_dir):
    out = subprocess.run(["node", "-e", NODE, plan_dir], capture_output=True, text=True)
    if out.returncode:
        sys.exit("Could not read the plan data:\n" + out.stderr)
    return json.loads(out.stdout)


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip()).lower()


def sql(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def arr(items):
    return "array[" + ", ".join(sql(x) for x in items) + "]::text[]" if items else "array[]::text[]"


def build(data, base_url):
    people = data["people"]
    by_key = {p["key"]: p for p in people}
    T = data["tracks"]
    # tracks-data detail per plan item: extra people and extra lines
    extra_people, extra_lines, steps = {}, {}, {}

    def add_people(pid, keys):
        for k in keys or []:
            if k in by_key:
                extra_people.setdefault(pid, []).append(k)

    for m in T.get("modules", []):
        pid = m.get("plan")
        if not pid: continue
        add_people(pid, m.get("teach"))
        extra_lines.setdefault(pid, []).append(f"Track B teaching module {m.get('n')}: {m.get('name')}. Learn: {m.get('learn', '')} Sessions: {m.get('sessions', '')}. Learners: {m.get('learners', '')}.")
        if m.get("check"): steps.setdefault(pid, []).append(("Check: " + m["check"])[:300])
    for d in T.get("demoFlow", []):
        pid = d.get("plan")
        if not pid: continue
        add_people(pid, d.get("who"))
        extra_lines.setdefault(pid, []).append(f"Track C demo step \"{d.get('step')}\": {d.get('what', '')} Time limit: {d.get('limit', '')}. Where: {d.get('where', '')}.")
    for d in T.get("pattern", []):
        if d.get("plan"): extra_lines.setdefault(d["plan"], []).append(f"Track C pattern, {d.get('when')}: {d.get('what')}")
    for d in T.get("flow", []):
        if d.get("plan"): extra_lines.setdefault(d["plan"], []).append(f"Partner step \"{d.get('step')}\": {d.get('what')}")
    for d in T.get("goals", []):
        if d.get("plan"): extra_lines.setdefault(d["plan"], []).append(f"Partner goal, {d.get('type')}: ask {d.get('ask')} Target: {d.get('target', '')}")
    for d in T.get("partners", []):
        pid = d.get("plan")
        if not pid: continue
        if d.get("owner"): add_people(pid, [d["owner"]])
        steps.setdefault(pid, []).append(f"{d.get('name')}: {d.get('next', '')}"[:300])

    rows, skipped_done = [], 0
    for x in data["acts"]:
        a, c, o = x["a"], x["c"], x["o"]
        if a.get("status") == "done":
            skipped_done += 1
            continue
        pid = a["id"]
        keys = list(a.get("roles") or [])
        owner = a.get("owner") or "Owner not named yet"
        if not keys:  # names written in the owner text, e.g. "XR Jags student team (Jahnavi, Jaden Martin, Samuel)"
            for p in people:
                if re.search(r"(?<![A-Za-z])" + re.escape(p["name"]) + r"(?![A-Za-z])", owner):
                    keys.append(p["key"])
        keys += extra_people.get(pid, [])
        seen, names = set(), []
        for k in keys:
            if k in by_key and k not in seen:
                seen.add(k); names.append(by_key[k]["name"])
        status, priority = STATUS.get(a.get("status") or "open", ("todo", "normal"))
        due = a.get("end") or a.get("date")
        when = a.get("due") or a.get("after") or (("Weekly from " + a["cal"]) if a.get("cal") else "No date yet")
        link = base_url.rstrip("/") + "/#" + pid
        det = [f"From the Foundations plan: item {pid.upper()} ({c['code']} · {o['name']}).",
               f"Owner in the plan: {owner}.", f"When: {when}."]
        if a.get("waiting"): det.append("Waiting on Southern University.")
        if a.get("status") == "parked": det.append("Parked in the plan (on hold for now).")
        if a.get("note"): det.append("Note: " + a["note"])
        det += extra_lines.get(pid, [])
        tail = "Open the plan item: " + link
        body = "\n".join(det)
        if len(body) + len(tail) + 2 > 4000: body = body[: 4000 - len(tail) - 3] + "…"
        title = re.sub(r"\s+", " ", a["name"]).strip()
        if len(title) > 200: title = title[:199] + "…"
        rows.append({"id": pid, "title": title, "details": body + "\n" + tail, "due": due, "status": status, "priority": priority,
                     "names": names, "owner": owner, "steps": [s for s in dict.fromkeys(steps.get(pid, [])) if s.strip()][:40], "plan_status": a.get("status")})
    return rows, skipped_done


def match_staff(name, staff):
    """Same rule as pg_temp.seed_match in the SQL: exact full name, else one unique first-name match
    when one side is a single word (e.g. staff "Lynelle" for plan "Lynelle Diolulu")."""
    n = norm(name)
    act = [s for s in staff if str(s.get("active", "true")).lower() not in ("false", "f", "0", "no")]
    exact = [s for s in act if norm(s["full_name"]) == n]
    if len(exact) == 1: return exact[0]
    if exact: return None
    loose = [s for s in act if norm(s["full_name"]).split(" ")[0] == n.split(" ")[0] and (" " not in norm(s["full_name"]) or " " not in n)]
    return loose[0] if len(loose) == 1 else None


SQL_HEAD = """-- =====================================================================================================
-- Foundations plan tasks -> live tasks (made by supabase/seed-plan-tasks.py on {made}, plan version {version}).
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Run in the Supabase SQL Editor, AFTER Block 3 and Block 6
-- (migration-plan-link.sql), and only after Sonny's OK. Do not edit by hand: change the plan, then run the script again.
--
-- Plain words:
--   * {n} tasks, one per plan item that is not done. A plan item that already has a task is skipped,
--     so running this file again makes no copies and changes nothing that people already worked on.
--   * People: each name the plan gives is matched to an active login in public.staff by full name, now.
--     Names with no matching login, and items with no named person, go to Lynelle ({admin}).
--   * The SQL Editor has no signed-in user, so this file signs the run in as Lynelle for this one transaction
--     (request.jwt.claims). The database rules then work as if Lynelle gave the tasks out: she is "made by",
--     the history says Lynelle, and people get the usual "Lynelle gave you a task" note in the dashboard.
--   * Stops with a plain message (and changes nothing) if Lynelle's staff login is not there or Block 6 is missing.
--   * The last result shows what happened: new tasks, assigned to named staff, sent to Lynelle.
-- =====================================================================================================

begin;

create temp table _plan_seed (
  plan_item_id text primary key, title text not null, details text, due_date date, status text not null, priority text not null,
  people text[] not null, steps text[] not null, ord int not null
) on commit drop;
create temp table _seed_new (id uuid primary key, plan_item_id text not null) on commit drop;

do $$
declare lyn uuid;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'plan_item_id') then
    raise exception 'Block 6 (migration-plan-link.sql) is not applied yet: public.tasks has no plan_item_id column. Run Block 6 first.';
  end if;
  select s.user_id into lyn from public.staff s left join auth.users u on u.id = s.user_id
   where s.active and lower(coalesce(nullif(s.email, ''), u.email)) = lower('{admin}')
   order by s.user_id limit 1;
  if lyn is null then
    raise exception 'No active staff login with email {admin} was found. Make Lynelle''s login and staff row first (migration-tasks.sql, step 8).';
  end if;
  -- sign this transaction in as Lynelle, so auth.uid() in the task triggers is her (it is null in the SQL Editor otherwise)
  perform set_config('request.jwt.claims', json_build_object('sub', lyn::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', lyn::text, true);
  perform set_config('seed.admin_id', lyn::text, true);
end $$;

-- same matching rule as the preview: exact full name, else one unique first-name match when one side is one word
create or replace function pg_temp.seed_match(p_name text) returns uuid language sql stable as $f$
  with n as (select lower(regexp_replace(btrim(p_name), '\\s+', ' ', 'g')) as v),
  s as (select user_id, lower(regexp_replace(btrim(full_name), '\\s+', ' ', 'g')) as v from public.staff where active),
  exact as (select s.user_id from s, n where s.v = n.v),
  loose as (select s.user_id from s, n where split_part(s.v, ' ', 1) = split_part(n.v, ' ', 1) and (position(' ' in s.v) = 0 or position(' ' in n.v) = 0))
  select case when (select count(*) from exact) = 1 then (select user_id from exact)
              when (select count(*) from exact) = 0 and (select count(*) from loose) = 1 then (select user_id from loose) end
$f$;

insert into _plan_seed (plan_item_id, title, details, due_date, status, priority, people, steps, ord) values
"""

SQL_TAIL = """;

-- 1) the tasks (skips plan items that already have one)
with ins as (
  insert into public.tasks (title, details, status, priority, due_date, created_by, plan_item_id)
  select p.title, p.details, p.status, p.priority, p.due_date, current_setting('seed.admin_id')::uuid, p.plan_item_id
    from _plan_seed p order by p.ord
  on conflict (plan_item_id) where plan_item_id is not null do nothing
  returning id, plan_item_id
)
insert into _seed_new (id, plan_item_id) select id, plan_item_id from ins;

-- 2) named people who have a staff login
insert into public.task_members (task_id, user_id, added_by)
select distinct n.id, m.uid, current_setting('seed.admin_id')::uuid
  from _seed_new n join _plan_seed p using (plan_item_id)
  cross join lateral unnest(p.people) as pn(name)
  cross join lateral (select pg_temp.seed_match(pn.name) as uid) m
 where m.uid is not null
on conflict (task_id, user_id) do nothing;

-- 3) Lynelle gets every new task with no named person, or with a named person who has no login
insert into public.task_members (task_id, user_id, added_by)
select n.id, current_setting('seed.admin_id')::uuid, current_setting('seed.admin_id')::uuid
  from _seed_new n join _plan_seed p using (plan_item_id)
 where cardinality(p.people) = 0
    or exists (select 1 from unnest(p.people) as pn(name) where pg_temp.seed_match(pn.name) is null)
on conflict (task_id, user_id) do nothing;

-- 4) checklist steps from the Track B / Track C detail
insert into public.task_checklist (task_id, text, position)
select n.id, st.text, st.pos - 1
  from _seed_new n join _plan_seed p using (plan_item_id)
  cross join lateral unnest(p.steps) with ordinality as st(text, pos);

-- what happened
select (select count(*) from _plan_seed) as plan_items,
       (select count(*) from _seed_new) as new_tasks,
       (select count(*) from _plan_seed) - (select count(*) from _seed_new) as already_there_skipped,
       (select count(*) from _seed_new n where exists (select 1 from public.task_members m where m.task_id = n.id and m.user_id <> current_setting('seed.admin_id')::uuid)) as new_with_named_staff,
       (select count(*) from _seed_new n where not exists (select 1 from public.task_members m where m.task_id = n.id and m.user_id <> current_setting('seed.admin_id')::uuid)) as new_only_lynelle,
       (select count(*) from _seed_new n where exists (select 1 from public.task_members m where m.task_id = n.id and m.user_id = current_setting('seed.admin_id')::uuid)) as new_lynelle_on_it;

commit;
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plan", default=os.environ.get("FOUNDATIONS_DIR", "/home/claude/immersion-in-motion-strategy-plan."))
    ap.add_argument("--base-url", default="https://immersion-foundations.vercel.app", help="Foundations site address for the links back")
    ap.add_argument("--staff", help="optional CSV export of public.staff (full_name,email,active) for an exact preview")
    ap.add_argument("--out-dir", default=HERE)
    a = ap.parse_args()
    data = load(a.plan)
    rows, skipped = build(data, a.base_url)
    values = []
    for i, r in enumerate(rows):
        values.append("  (" + ", ".join([sql(r["id"]), sql(r["title"]), sql(r["details"]), (sql(r["due"]) + "::date") if r["due"] else "null",
                                       sql(r["status"]), sql(r["priority"]), arr(r["names"]), arr(r["steps"]), str(i)]) + ")")
    made = datetime.date.today().isoformat()
    head = SQL_HEAD.replace("{made}", made).replace("{version}", str(data.get("version", ""))).replace("{n}", str(len(rows))).replace("{admin}", ADMIN_EMAIL)
    os.makedirs(a.out_dir, exist_ok=True)
    sql_path = os.path.join(a.out_dir, "seed-plan-tasks.sql")
    with open(sql_path, "w") as f:
        f.write(head + ",\n".join(values) + SQL_TAIL)

    staff = None
    if a.staff:
        with open(a.staff, newline="") as f:
            staff = list(csv.DictReader(f))
    csv_path = os.path.join(a.out_dir, "seed-plan-tasks-preview.csv")
    named = only_admin = 0
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Plan item", "Title", "Owner in plan", "People named in plan", "Will be assigned to", "Due date", "Status", "Priority", "Checklist steps"])
        for r in rows:
            if staff is None:
                if r["names"]:
                    to = "; ".join(r["names"]) + " (each one whose staff login has this name; anyone without a login goes to " + ADMIN_LABEL + ")"
                    named += 1
                else:
                    to = ADMIN_LABEL; only_admin += 1
            else:
                hits, miss = [], False
                for n in r["names"]:
                    s = match_staff(n, staff)
                    if s: hits.append(ADMIN_LABEL if norm(s.get("email")) == ADMIN_EMAIL else s["full_name"])
                    else: miss = True
                hits = list(dict.fromkeys(hits))
                if not r["names"] or miss: hits.append(ADMIN_LABEL)
                to = "; ".join(dict.fromkeys(hits))
                if any(h != ADMIN_LABEL for h in hits): named += 1
                else: only_admin += 1
            w.writerow([r["id"].upper(), r["title"], r["owner"], "; ".join(r["names"]) or "None", to, r["due"] or "", {"todo": "To do", "doing": "Working on it"}[r["status"]], r["priority"], len(r["steps"])])
    print(f"plan items made into tasks: {len(rows)} (done items left out: {skipped})")
    print(f"with a named person: {named}; only Lynelle: {only_admin}" + ("" if staff is not None else " (named people still need a staff login with that name)"))
    print("wrote", sql_path)
    print("wrote", csv_path)


if __name__ == "__main__":
    main()
