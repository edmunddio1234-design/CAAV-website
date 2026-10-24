-- =====================================================================================================
-- Foundations plan tasks -> live tasks (made by supabase/seed-plan-tasks.py on 2026-10-24, plan version October 24, 2026).
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Run in the Supabase SQL Editor, AFTER Block 3 and Block 6
-- (migration-plan-link.sql), and only after Sonny's OK. Do not edit by hand: change the plan, then run the script again.
--
-- Plain words:
--   * 169 tasks, one per plan item that is not done. A plan item that already has a task is skipped,
--     so running this file again makes no copies and changes nothing that people already worked on.
--   * People: each name the plan gives is matched to an active login in public.staff by full name, now.
--     Names with no matching login, and items with no named person, go to Lynelle (lynelle@missionmetrics.solutions).
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
   where s.active and lower(coalesce(nullif(s.email, ''), u.email)) = lower('lynelle@missionmetrics.solutions')
   order by s.user_id limit 1;
  if lyn is null then
    raise exception 'No active staff login with email lynelle@missionmetrics.solutions was found. Make Lynelle''s login and staff row first (migration-tasks.sql, step 8).';
  end if;
  -- sign this transaction in as Lynelle, so auth.uid() in the task triggers is her (it is null in the SQL Editor otherwise)
  perform set_config('request.jwt.claims', json_build_object('sub', lyn::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', lyn::text, true);
  perform set_config('seed.admin_id', lyn::text, true);
end $$;

-- same matching rule as the preview: exact full name, else one unique first-name match when one side is one word
create or replace function pg_temp.seed_match(p_name text) returns uuid language sql stable as $f$
  with n as (select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g')) as v),
  s as (select user_id, lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g')) as v from public.staff where active),
  exact as (select s.user_id from s, n where s.v = n.v),
  loose as (select s.user_id from s, n where split_part(s.v, ' ', 1) = split_part(n.v, ' ', 1) and (position(' ' in s.v) = 0 or position(' ' in n.v) = 0))
  select case when (select count(*) from exact) = 1 then (select user_id from exact)
              when (select count(*) from exact) = 0 and (select count(*) from loose) = 1 then (select user_id from loose) end
$f$;

insert into _plan_seed (plan_item_id, title, details, due_date, status, priority, people, steps, ord) values
  ('c1-a4', 'Get written clearance for logos, names and photos', 'From the Foundations plan: item C1-A4 (C1 · Decisions and permissions).
Owner in the plan: Deanna Smith and Deidre Street (Southern University).
When: Oct 21–27, 2026.
Waiting on Southern University.
Note: Needed from the CAAV board and Southern University for names, logos and photos. Oct 21, 2026: Deidre Street secures written media clearance in Phase 1, with Deanna Smith. Source: SU meeting Oct 21, 2026 and the SU XR Mobile Launch Roles & Responsibilities matrix.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a4', '2026-10-27'::date, 'todo', 'high', array['Deanna Smith', 'Deidre Street']::text[], array[]::text[], 0),
  ('c1-a19', 'Send the exact funding disclaimer taglines (NSF, NTIA, Louisiana Department of Health)', 'From the Foundations plan: item C1-A19 (C1 · Decisions and permissions).
Owner in the plan: Deidre Street (Southern University).
When: No date yet.
Waiting on Southern University.
Note: Needed for the Projects page agency disclaimers. Source: SU meeting Oct 21, 2026 and the SU XR Mobile Launch Roles & Responsibilities matrix.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a19', null, 'todo', 'normal', array['Deidre Street']::text[], array[]::text[], 1),
  ('c1-a20', 'Send the student-site link and the OneDrive folder (summer camp photos, agendas, speaker details, videos)', 'From the Foundations plan: item C1-A20 (C1 · Decisions and permissions).
Owner in the plan: Deidre Street (Southern University).
When: No date yet.
Waiting on Southern University.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a20', null, 'todo', 'normal', array['Deidre Street']::text[], array[]::text[], 2),
  ('c1-a21', 'Send the stakeholder contact lists: student team, K-12 teachers at EBR, Helix and Southern Lab, MechDyne marketing leads, federal grant officers', 'From the Foundations plan: item C1-A21 (C1 · Decisions and permissions).
Owner in the plan: Deidre Street (Southern University).
When: No date yet.
Waiting on Southern University.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a21', null, 'todo', 'normal', array['Deidre Street']::text[], array[]::text[], 3),
  ('c1-a22', 'Share the Nexus Louisiana residency press releases and tech partner details', 'From the Foundations plan: item C1-A22 (C1 · Decisions and permissions).
Owner in the plan: Deidre Street (Southern University).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a22', null, 'todo', 'normal', array['Deidre Street', 'Lynelle Diolulu']::text[], array['Nexus Louisiana: NDA. Deidre Street shares the residency press releases and tech partner details (C1-A22).']::text[], 4),
  ('c1-a8', 'Decide where requests land and add analytics', 'From the Foundations plan: item C1-A8 (C1 · Public page and booking).
Owner in the plan: Owner not named yet.
When: Oct 14–20, 2026.
Note: Add a Supabase table so requests are saved, not only emailed. Add analytics before launch for visit counts.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a8', '2026-10-20'::date, 'todo', 'high', array[]::text[], array[]::text[], 5),
  ('c1-a9', 'Replace the vehicle concept image with a real photo (media/truck-tall.jpg)', 'From the Foundations plan: item C1-A9 (C1 · Public page and booking).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: The AI concept image is in place until the real photo is taken.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a9', null, 'todo', 'normal', array[]::text[], array[]::text[], 6),
  ('c1-a10', 'Replace the learner concept image with a real photo (demo-in-use.jpg)', 'From the Foundations plan: item C1-A10 (C1 · Public page and booking).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: The AI concept image is in place until the real photo is taken.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 7),
  ('c1-a23', 'Begin the site migration: XR Jags rebranding and the About page', 'From the Foundations plan: item C1-A23 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: Oct 21–27, 2026.
Note: Phase 1 of the launch countdown.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a23', '2026-10-27'::date, 'doing', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 8),
  ('c1-a24', 'Add the launch pop-up and the Book a Tour form (Book a Tour and About migration)', 'From the Foundations plan: item C1-A24 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Phase 2 of the launch countdown.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a24', '2026-11-03'::date, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 9),
  ('c1-a25', 'XR Jags Team and Initiatives pages', 'From the Foundations plan: item C1-A25 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: No date yet.
Note: Uses the student headshots and LinkedIn URLs.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a25', null, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 10),
  ('c1-a26', 'Projects page with the agency disclaimers', 'From the Foundations plan: item C1-A26 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: No date yet.
Note: Waits on the exact disclaimer taglines (NSF, NTIA, Louisiana Department of Health).
Open the plan item: https://immersion-foundations.vercel.app/#c1-a26', null, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 11),
  ('c1-a27', 'User logins for the student leads and leadership', 'From the Foundations plan: item C1-A27 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a27', null, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 12),
  ('c1-a28', 'Final website go-live check and form validation', 'From the Foundations plan: item C1-A28 (C1 · XR Jags site rebuild and migration).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: Week before opening (date to be set).
Note: Phase 4 of the launch countdown.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a28', null, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 13),
  ('c1-a29', 'Send headshots, LinkedIn URLs and summer camp media to Sonny', 'From the Foundations plan: item C1-A29 (C1 · XR Jags site rebuild and migration).
Owner in the plan: XR Jags student team (Jahnavi, Jaden Martin, Samuel).
When: No date yet.
Waiting on Southern University.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a29', null, 'todo', 'normal', array['Jahnavi', 'Jaden Martin', 'Samuel']::text[], array[]::text[], 14),
  ('c1-a30', 'Submit two contract quotes: one to Deanna Smith (XR Jags website, data capture and campaign design), one to Deidre Street (campaign implementation through 11/20/26)', 'From the Foundations plan: item C1-A30 (C1 · Contract and launch-marketing funding).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a30', null, 'todo', 'high', array['Lynelle Diolulu']::text[], array[]::text[], 15),
  ('c1-a31', 'Arrange funding for Mission Metrics'' launch marketing (about 5 weeks at 20 hours a week at $75 an hour)', 'From the Foundations plan: item C1-A31 (C1 · Contract and launch-marketing funding).
Owner in the plan: Deidre Street (Southern University).
When: No date yet.
Waiting on Southern University.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a31', null, 'todo', 'normal', array['Deidre Street']::text[], array[]::text[], 16),
  ('c1-a32', 'Official marketing communications go out from lynelle@missionmetrics.solutions', 'From the Foundations plan: item C1-A32 (C1 · Contract and launch-marketing funding).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c1-a32', null, 'doing', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 17),
  ('c2-a1', 'Build the four lists', 'From the Foundations plan: item C2-A1 (C2 · Target lists).
Owner in the plan: Mission Metrics.
When: Oct 14–20, 2026.
Note: 40 plants and contractors, 30 sponsor targets, 20 health and public-safety organizations, 20 schools.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a1', '2026-10-20'::date, 'doing', 'normal', array[]::text[], array[]::text[], 18),
  ('c2-a2', 'First offer for each of the twelve kinds of organizations', 'From the Foundations plan: item C2-A2 (C2 · Target lists).
Owner in the plan: Mission Metrics.
When: No date yet.
Note: Twelve kinds of organizations, each with a first offer (for example, a 20-minute demo at the plant gate, then a one-team pilot).
Open the plan item: https://immersion-foundations.vercel.app/#c2-a2', null, 'todo', 'normal', array[]::text[], array[]::text[], 19),
  ('c2-a3', 'Open every conversation with the barrier question (20 minutes)', 'From the Foundations plan: item C2-A3 (C2 · Barrier conversations).
Owner in the plan: Mission Metrics.
When: Oct 20 – Nov 10, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a3', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 20),
  ('c2-a4', 'First conversations, toward the 10 by Nov 10', 'From the Foundations plan: item C2-A4 (C2 · Barrier conversations).
Owner in the plan: Mission Metrics.
When: Oct 21–27, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a4', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 21),
  ('c2-a5', 'Target: 10 sponsor or customer conversations held', 'From the Foundations plan: item C2-A5 (C2 · Barrier conversations).
Owner in the plan: Mission Metrics.
When: Nov 10, 2026.
Note: Counted in the outreach log.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a5', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 22),
  ('c2-a6', 'Pick the scenario that answers their barrier. Confirm it exists before promising a demo', 'From the Foundations plan: item C2-A6 (C2 · Demos).
Owner in the plan: Unit owner.
When: Before the first demo offer.
Note: Biggest risk: a demo for a scenario that does not exist yet. The flyer names fields, not courses.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a6', null, 'todo', 'high', array[]::text[], array[]::text[], 23),
  ('c2-a7', '20-minute on-site demo offer to every lead within 48 hours', 'From the Foundations plan: item C2-A7 (C2 · Demos).
Owner in the plan: Mission Metrics.
When: Weeks 1–10 after opening.
Note: Book demos toward the 5 booked about 4 weeks after opening. Demo scheduling runs through Track C (C9).
Open the plan item: https://immersion-foundations.vercel.app/#c2-a7', null, 'todo', 'normal', array[]::text[], array[]::text[], 24),
  ('c2-a8', 'Target: 5 demos booked across plants, schools and health partners', 'From the Foundations plan: item C2-A8 (C2 · Demos).
Owner in the plan: Mission Metrics.
When: About 4 weeks after opening.
Note: Counted on the booking form.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a8', null, 'todo', 'normal', array[]::text[], array[]::text[], 25),
  ('c2-a9', 'End every demo with a pilot offer', 'From the Foundations plan: item C2-A9 (C2 · Pilots and results).
Owner in the plan: Mission Metrics.
When: After each demo.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a9', null, 'todo', 'normal', array[]::text[], array[]::text[], 26),
  ('c2-a10', 'Run the pilot and collect before-and-after numbers the customer chooses', 'From the Foundations plan: item C2-A10 (C2 · Pilots and results).
Owner in the plan: Mission Metrics.
When: During each pilot.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 27),
  ('c2-a11', 'Target: 1 signed pilot with a measured result', 'From the Foundations plan: item C2-A11 (C2 · Pilots and results).
Owner in the plan: Mission Metrics.
When: About 10 weeks after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a11', null, 'todo', 'normal', array[]::text[], array[]::text[], 28),
  ('c2-a12', 'Report the result to the customer first, then publish a short results note', 'From the Foundations plan: item C2-A12 (C2 · Pilots and results).
Owner in the plan: Mission Metrics.
When: After each pilot.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a12', null, 'todo', 'normal', array[]::text[], array[]::text[], 29),
  ('c2-a13', 'Ask for a referral, a co-hosted demo day, or a sponsor seat', 'From the Foundations plan: item C2-A13 (C2 · Pilots and results).
Owner in the plan: Mission Metrics.
When: After each pilot.
Open the plan item: https://immersion-foundations.vercel.app/#c2-a13', null, 'todo', 'normal', array[]::text[], array[]::text[], 30),
  ('c3-a1', 'Build the 30-name sponsor list', 'From the Foundations plan: item C3-A1 (C3 · Sponsor list and packages).
Owner in the plan: Mission Metrics.
When: Oct 14–20, 2026.
Note: Banks, insurers, plants, health systems, foundations, industry groups.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a1', '2026-10-20'::date, 'doing', 'normal', array[]::text[], array['Each name on the 30-name sponsor list: One row per name once the list is final (C3-A1).']::text[], 31),
  ('c3-a2', 'Get written package amounts from the project director', 'From the Foundations plan: item C3-A2 (C3 · Sponsor list and packages).
Owner in the plan: Project director (Southern University).
When: Before the ask.
Note: Contact on the flyer: Project Director Deidre Hardy Street, deidre.street@sus.edu. Quote only the amounts the project director gives. Oct 21, 2026: Lynelle Diolulu drafts the tiers (c3-a16) and Deanna Smith reviews tiers and pricing (c3-a17).
Open the plan item: https://immersion-foundations.vercel.app/#c3-a2', null, 'todo', 'high', array[]::text[], array[]::text[], 32),
  ('c3-a16', 'Draft the tiered sponsorship packages: exterior truck branding stickers ($10,000+, multi-year), interior wall and equipment, software module pop-ups, classroom VR headsets', 'From the Foundations plan: item C3-A16 (C3 · Sponsor list and packages).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: The $10,000+ figure is the stated starting point for the exterior truck tier. Other tiers have no amount yet.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a16', '2026-11-03'::date, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 33),
  ('c3-a17', 'Review the sponsorship tiers and pricing', 'From the Foundations plan: item C3-A17 (C3 · Sponsor list and packages).
Owner in the plan: Deanna Smith (Southern University).
When: No date yet.
Waiting on Southern University.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a17', null, 'todo', 'normal', array['Deanna Smith']::text[], array[]::text[], 34),
  ('c3-a3', 'Four packages: Presenting, Workforce, Community, Supporter', 'From the Foundations plan: item C3-A3 (C3 · Sponsor list and packages).
Owner in the plan: Mission Metrics.
When: Before the ask.
Note: Built on the flyer’s five sponsor benefits. We add a sixth: results reports.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a3', null, 'todo', 'normal', array[]::text[], array[]::text[], 35),
  ('c3-a4', 'CAAV board approves any sponsor naming on CAAV pages', 'From the Foundations plan: item C3-A4 (C3 · Sponsor list and packages).
Owner in the plan: the CAAV board.
When: Before any sponsor naming.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a4', null, 'todo', 'normal', array[]::text[], array[]::text[], 36),
  ('c3-a18', 'Before detailed talks: NDA signed with the potential partner (then the MOU)', 'From the Foundations plan: item C3-A18 (C3 · The ask ladder).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Oct 24, 2026 (stated by you): an NDA for each potential partner, signed before detailed talks or before plans or budgets are shared. A first 20-minute conversation can come before it.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a18', null, 'todo', 'high', array[]::text[], array[]::text[], 37),
  ('c3-a5', 'Step 1: a 20-minute conversation about what stops them training more people', 'From the Foundations plan: item C3-A5 (C3 · The ask ladder).
Owner in the plan: Mission Metrics.
When: Oct 20 – Nov 10, 2026.
Partner step "First conversation and partner demo": The barrier question, then a private partner demo.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a5', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 38),
  ('c3-a7', 'Step 2: a place at the opening', 'From the Foundations plan: item C3-A7 (C3 · The ask ladder).
Owner in the plan: Mission Metrics.
When: By Nov 10, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a7', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 39),
  ('c3-a8', 'Confirm opening sponsors and sponsor logos', 'From the Foundations plan: item C3-A8 (C3 · The ask ladder).
Owner in the plan: Mission Metrics.
When: Nov 4–10, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a8', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 40),
  ('c3-a9', 'Step 3: a sponsorship package', 'From the Foundations plan: item C3-A9 (C3 · The ask ladder).
Owner in the plan: Mission Metrics.
When: Before the opening.
Note: Quote amounts only after the project director gives them.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a9', null, 'todo', 'normal', array[]::text[], array[]::text[], 41),
  ('c3-a10', 'Target: 3 sponsor commitments announced', 'From the Foundations plan: item C3-A10 (C3 · Announce and deliver).
Owner in the plan: Mission Metrics.
When: Opening day.
Note: Counted on the sponsor list.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 42),
  ('c3-a11', 'Joint announcement, logo on vehicle and events', 'From the Foundations plan: item C3-A11 (C3 · Announce and deliver).
Owner in the plan: Mission Metrics.
When: Opening day.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a11', null, 'todo', 'normal', array[]::text[], array[]::text[], 43),
  ('c3-a12', 'Follow-up to every sponsor and lead', 'From the Foundations plan: item C3-A12 (C3 · Announce and deliver).
Owner in the plan: Mission Metrics.
When: Within 2 days after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a12', null, 'todo', 'normal', array[]::text[], array[]::text[], 44),
  ('c3-a13', 'Thank every partner within 24 hours', 'From the Foundations plan: item C3-A13 (C3 · Renewals).
Owner in the plan: Mission Metrics.
When: Day after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a13', null, 'todo', 'normal', array[]::text[], array[]::text[], 45),
  ('c3-a14', 'Step 4: a pilot at their site, or a co-hosted demo day for their members', 'From the Foundations plan: item C3-A14 (C3 · Renewals).
Owner in the plan: Mission Metrics.
When: After opening, from week 2.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a14', null, 'todo', 'normal', array[]::text[], array[]::text[], 46),
  ('c3-a15', 'Send a quarterly results note. Call for renewal', 'From the Foundations plan: item C3-A15 (C3 · Renewals).
Owner in the plan: Mission Metrics.
When: Quarterly.
Open the plan item: https://immersion-foundations.vercel.app/#c3-a15', null, 'todo', 'normal', array[]::text[], array[]::text[], 47),
  ('c4-a12', 'Draft press kit and three angles', 'From the Foundations plan: item C4-A12 (C4 · Press kit and media day).
Owner in the plan: Owner not named yet.
When: Oct 14–20, 2026.
Note: A student-conceived mobile CAVE, veterans train on technology that comes to them, a science class on wheels.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a12', '2026-10-20'::date, 'doing', 'normal', array[]::text[], array[]::text[], 48),
  ('c4-a13', 'Embargoed save-the-date to local outlets in Baton Rouge, New Orleans and Shreveport', 'From the Foundations plan: item C4-A13 (C4 · Press kit and media day).
Owner in the plan: Owner not named yet.
When: Oct 28 – Nov 3, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a13', '2026-11-03'::date, 'todo', 'normal', array[]::text[], array[]::text[], 49),
  ('c4-a14', 'Media advisory for the opening', 'From the Foundations plan: item C4-A14 (C4 · Press kit and media day).
Owner in the plan: Owner not named yet.
When: Nov 4–10, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a14', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 50),
  ('c4-a15', 'Finish press kit. Invite media', 'From the Foundations plan: item C4-A15 (C4 · Press kit and media day).
Owner in the plan: Owner not named yet.
When: Week before opening (date to be set).
Open the plan item: https://immersion-foundations.vercel.app/#c4-a15', null, 'todo', 'normal', array[]::text[], array[]::text[], 51),
  ('c4-a16', 'Media day: a ten-minute simulation for every reporter', 'From the Foundations plan: item C4-A16 (C4 · Press kit and media day).
Owner in the plan: Owner not named yet.
When: Week before opening (date to be set).
Open the plan item: https://immersion-foundations.vercel.app/#c4-a16', null, 'todo', 'normal', array[]::text[], array[]::text[], 52),
  ('c4-a37', 'Build the local news list: TV, radio and print in Baton Rouge, New Orleans and Shreveport', 'From the Foundations plan: item C4-A37 (C4 · Press kit and media day).
Owner in the plan: Mission Metrics.
When: Oct 21–27, 2026.
Note: Outlets checked Oct 19, 2026, listed on the Marketing plan page. Baton Rouge: WBRZ 2 (ABC), WAFB 9 (CBS), WVLA 33 (NBC), Fox 44 WGMB, LPB, WRKF 89.3, WJBO 1150, The Advocate, Louisiana Illuminator, Business Report, Southern University Digest. New Orleans: WWL-TV 4 (CBS), WDSU 6 (NBC), FOX 8 WVUE, WGNO 26 (ABC), WWNO 89.9, WWL 870 AM / 105.3 FM, WBOK 1230, The Times-Picayune | The New Orleans Advocate, The Louisiana Weekly. Shreveport: KSLA 12 (CBS), KTBS 3 (ABC), KTAL 6 (NBC), Red River Radio KDAQ 89.9, The Shreveport Times, The Shreveport Sun, Bossier Press-Tribune. Still to do: the right reporter or desk at each. Oct 21, 2026: University Communications (Robyn Merrick, Janine Tate) coordinates WAFB, WBRZ and the Student Digest for the launch (c4-a44).
Open the plan item: https://immersion-foundations.vercel.app/#c4-a37', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 53),
  ('c4-a42', 'Draft the launch press release (quotes from Jaden Martin and Deidre Street) for Southern University approval', 'From the Foundations plan: item C4-A42 (C4 · Press kit and media day).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Phase 2 of the launch countdown.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a42', '2026-11-03'::date, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 54),
  ('c4-a43', 'Submit the press release and marquee graphics to Robyn Merrick and Janine Tate', 'From the Foundations plan: item C4-A43 (C4 · Press kit and media day).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Robyn Merrick, VP of Communications; Janine Tate, Director of Communications.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a43', '2026-11-03'::date, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 55),
  ('c4-a44', 'Approve the press release. Coordinate photographers, videographers and local media (WAFB, WBRZ, Student Digest)', 'From the Foundations plan: item C4-A44 (C4 · Press kit and media day).
Owner in the plan: University Communications (Robyn Merrick, Janine Tate).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a44', null, 'todo', 'normal', array['Robyn Merrick', 'Janine Tate']::text[], array[]::text[], 56),
  ('c4-a45', 'Prepare remarks and quotes for the launch', 'From the Foundations plan: item C4-A45 (C4 · Press kit and media day).
Owner in the plan: Jaden Martin (XR Jags student team).
When: Before the opening.
Note: Jaden Martin and Deidre Street are the media spokespeople.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a45', null, 'todo', 'normal', array['Jaden Martin']::text[], array[]::text[], 57),
  ('c4-a38', 'Offer New Orleans and Shreveport outlets a remote demo or an interview, since the unit is in Baton Rouge on opening day', 'From the Foundations plan: item C4-A38 (C4 · Press kit and media day).
Owner in the plan: Mission Metrics.
When: Week before opening (date to be set).
Open the plan item: https://immersion-foundations.vercel.app/#c4-a38', null, 'todo', 'normal', array[]::text[], array[]::text[], 58),
  ('c4-a17', 'Grand opening, Southern University, Baton Rouge (opening date to be determined)', 'From the Foundations plan: item C4-A17 (C4 · Grand opening (date to be determined)).
Owner in the plan: Owner not named yet.
When: Opening day.
Note: The printed flyer gave the first date. Oct 24, 2026 (stated by you): the opening date is now to be determined. The site stays in front of the Leon Waters Museum, reserved via Kuala Chambers, and the 11:00 AM slot is to be confirmed with the new date. Run of show under C4, Launch Day.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a17', null, 'todo', 'normal', array[]::text[], array[]::text[], 59),
  ('c4-a18', 'Capture a student, a plant trainer, a veteran and a nurse using it', 'From the Foundations plan: item C4-A18 (C4 · Grand opening (date to be determined)).
Owner in the plan: Owner not named yet.
When: Opening day.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a18', null, 'todo', 'normal', array[]::text[], array[]::text[], 60),
  ('c4-a19', 'Every guest signs in', 'From the Foundations plan: item C4-A19 (C4 · Grand opening (date to be determined)).
Owner in the plan: Owner not named yet.
When: Opening day.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a19', null, 'todo', 'normal', array[]::text[], array[]::text[], 61),
  ('c4-a20', 'Recap page and release', 'From the Foundations plan: item C4-A20 (C4 · Grand opening (date to be determined)).
Owner in the plan: Owner not named yet.
When: Day after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a20', null, 'todo', 'normal', array[]::text[], array[]::text[], 62),
  ('c4-a21', '48-hour follow-up. Start booking demos', 'From the Foundations plan: item C4-A21 (C4 · Grand opening (date to be determined)).
Owner in the plan: Owner not named yet.
When: Within 48 hours after opening, then week 1.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a21', null, 'todo', 'normal', array[]::text[], array[]::text[], 63),
  ('c4-a22', 'Shot list. Post the barrier question', 'From the Foundations plan: item C4-A22 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Oct 14–20, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a22', '2026-10-20'::date, 'doing', 'normal', array[]::text[], array[]::text[], 64),
  ('c4-a23', 'Replace the Gemini clip end card with a clean branded card', 'From the Foundations plan: item C4-A23 (C4 · Video and social).
Owner in the plan: You (decision 6).
When: Before the clip goes public.
Note: The current card has garbled text, a QR code that does not scan, and the Southern University logo.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a23', null, 'todo', 'high', array[]::text[], array[]::text[], 65),
  ('c4-a24', 'Behind-the-build post', 'From the Foundations plan: item C4-A24 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Oct 21–27, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a24', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 66),
  ('c4-a25', '30-second teaser', 'From the Foundations plan: item C4-A25 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Oct 28 – Nov 3, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a25', '2026-11-03'::date, 'todo', 'normal', array[]::text[], array[]::text[], 67),
  ('c4-a26', 'Countdown posts, one a day for the last 5 days before the opening', 'From the Foundations plan: item C4-A26 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Last 5 days before opening.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a26', null, 'todo', 'normal', array[]::text[], array[]::text[], 68),
  ('c4-a28', 'Live clips on opening day. Audience-specific cuts after', 'From the Foundations plan: item C4-A28 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Opening day, then week 1 after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a28', null, 'todo', 'normal', array[]::text[], array[]::text[], 69),
  ('c4-a39', 'Launch the social countdown on LinkedIn, Instagram and Facebook', 'From the Foundations plan: item C4-A39 (C4 · Video and social).
Owner in the plan: Jahnavi (XR Jags student team).
When: Nov 4–10, 2026.
Note: Phase 3 of the launch countdown.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a39', '2026-11-10'::date, 'todo', 'normal', array['Jahnavi']::text[], array[]::text[], 70),
  ('c4-a40', 'Manage LinkedIn, Instagram and Facebook and log activity in the shared dashboard', 'From the Foundations plan: item C4-A40 (C4 · Video and social).
Owner in the plan: XR Jags student team (Jahnavi, Jaden Martin, Samuel).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a40', null, 'doing', 'normal', array['Jahnavi', 'Jaden Martin', 'Samuel']::text[], array[]::text[], 71),
  ('c4-a41', 'Student social media strategy, with Jahnavi', 'From the Foundations plan: item C4-A41 (C4 · Video and social).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a41', null, 'todo', 'normal', array['Lynelle Diolulu', 'Jahnavi']::text[], array[]::text[], 72),
  ('c4-a29', 'Weekly clip by audience', 'From the Foundations plan: item C4-A29 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: Weekly, from week 2 after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a29', null, 'todo', 'normal', array[]::text[], array[]::text[], 73),
  ('c4-a30', 'NotebookLM package: 4 source files and a prompt for a cinematic video', 'From the Foundations plan: item C4-A30 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Ready. Not generated.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a30', null, 'todo', 'normal', array[]::text[], array[]::text[], 74),
  ('c4-a31', 'Seedance clip prompts: truck arrival, science, plant drill, healthcare, loop', 'From the Foundations plan: item C4-A31 (C4 · Video and social).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Written. Not run.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a31', null, 'todo', 'normal', array[]::text[], array[]::text[], 75),
  ('c4-a32', 'Plant one-pager and sponsor one-pager', 'From the Foundations plan: item C4-A32 (C4 · Owned and paid lanes).
Owner in the plan: Owner not named yet.
When: Before the sponsor asks.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a32', null, 'todo', 'normal', array[]::text[], array[]::text[], 76),
  ('c4-a33', 'First quotes on the page', 'From the Foundations plan: item C4-A33 (C4 · Owned and paid lanes).
Owner in the plan: Owner not named yet.
When: Oct 21–27, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a33', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 77),
  ('c4-a35', 'Paid tests: professional-network ads aimed at plant, contractor and hospital training roles near Baton Rouge; test two offers', 'From the Foundations plan: item C4-A35 (C4 · Owned and paid lanes).
Owner in the plan: Owner not named yet.
When: Weeks 2–4 after opening.
Note: Measure: cost per booked demo.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a35', null, 'todo', 'normal', array[]::text[], array[]::text[], 78),
  ('c4-a36', 'Monthly results note', 'From the Foundations plan: item C4-A36 (C4 · Owned and paid lanes).
Owner in the plan: Owner not named yet.
When: Monthly, from week 2 after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a36', null, 'todo', 'normal', array[]::text[], array[]::text[], 79),
  ('c4-a47', 'Finalize the truck wrap design and get Southern University approval', 'From the Foundations plan: item C4-A47 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Deanna Smith (Southern University).
When: Fri Oct 23, 2026.
Waiting on Southern University.
Note: Phase 1. Deanna Smith submits the wrap design for approval.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a47', '2026-10-23'::date, 'todo', 'high', array['Deanna Smith']::text[], array[]::text[], 80),
  ('c4-a48', 'Deliver the wrap artwork to Matt at Rapture Graphics', 'From the Foundations plan: item C4-A48 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Deanna Smith (Southern University).
When: Oct 21–27, 2026.
Note: Phase 1 hand-off to Rapture Graphics.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a48', '2026-10-27'::date, 'todo', 'normal', array['Deanna Smith', 'Rapture Graphics']::text[], array[]::text[], 81),
  ('c4-a49', 'Truck wrapping completed at Rapture Graphics', 'From the Foundations plan: item C4-A49 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Rapture Graphics (Matt).
When: Oct 28 – Nov 3, 2026.
Note: Phase 2.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a49', '2026-11-03'::date, 'todo', 'normal', array['Rapture Graphics']::text[], array[]::text[], 82),
  ('c4-a50', 'Share the wrap art and high-res photos of the wrapped truck (for the site and flyers)', 'From the Foundations plan: item C4-A50 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Deanna Smith (Southern University).
When: Nov 4–10, 2026.
Waiting on Southern University.
Note: Phase 3. The photos replace the AI concept image of the vehicle (c1-a9).
Open the plan item: https://immersion-foundations.vercel.app/#c4-a50', '2026-11-10'::date, 'todo', 'normal', array['Deanna Smith']::text[], array[]::text[], 83),
  ('c4-a51', 'Launch flyer and flyer mock-ups', 'From the Foundations plan: item C4-A51 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Phase 2.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a51', '2026-11-03'::date, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 84),
  ('c4-a52', 'Electronic marquee graphic for Harding Blvd and Scenic Hwy', 'From the Foundations plan: item C4-A52 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Sonny Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Submitted with the press release in Phase 2. Waits on the marquee specs.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a52', '2026-11-03'::date, 'todo', 'normal', array['Sonny Diolulu']::text[], array[]::text[], 85),
  ('c4-a68', 'Marquee specs for the sign at Harding Blvd and Scenic Hwy', 'From the Foundations plan: item C4-A68 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Owner not named yet.
When: No date yet.
Waiting on Southern University.
Note: Needed before the marquee graphic (c4-a52) can be finished. Who sends them is not named yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a68', null, 'todo', 'normal', array[]::text[], array[]::text[], 86),
  ('c4-a53', 'Schedule the marquee: signage live on Harding Blvd at Scenic Hwy', 'From the Foundations plan: item C4-A53 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: University Communications (Robyn Merrick, Janine Tate).
When: Nov 4–10, 2026.
Note: Phase 3.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a53', '2026-11-10'::date, 'todo', 'normal', array['Robyn Merrick', 'Janine Tate']::text[], array[]::text[], 87),
  ('c4-a54', 'VIP invitation outreach: Councilman Anthony Kenny, Rinaldi Jacobs, the Mayor''s Office, Kermit Johnson (Airport Board / Dr. Carpenter''s Office), B1 Bank (Will Campbell), Nexus Louisiana', 'From the Foundations plan: item C4-A54 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Oct 28 – Nov 3, 2026.
Note: Councilman Anthony Kenny: noted as $50k grant potential. No contact details are kept here.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a54', '2026-11-03'::date, 'todo', 'normal', array['Lynelle Diolulu']::text[], array['B1 Bank (Will Campbell): NDA before any package talk.', 'Councilman Anthony Kenny: Ask Southern University''s sponsored programs office how a council grant is handled before any NDA.', 'Kermit Johnson (Airport Board / Dr. Carpenter''s Office): Invite to a partner demo after the NDA.', 'Rinaldi Jacobs: Invite to a partner demo after the NDA.', 'Mayor''s Office: Ask legal whether a public office signs an NDA; then the MOU.']::text[], 88),
  ('c4-a55', 'Formal invitations to teachers at EBR, Helix and Southern Lab, grant officers and media', 'From the Foundations plan: item C4-A55 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Owner not named yet.
When: Nov 4–10, 2026.
Note: Phase 3. Owner not named yet. Uses Deidre Street''s stakeholder contact lists.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a55', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array['Teachers at EBR: From Deidre Street''s stakeholder lists (C1-A21).', 'Teachers at Helix: From Deidre Street''s stakeholder lists (C1-A21).', 'Teachers at Southern Lab: From Deidre Street''s stakeholder lists (C1-A21).']::text[], 89),
  ('c4-a56', 'MechDyne marketing contact', 'From the Foundations plan: item C4-A56 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a56', null, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 90),
  ('c4-a57', 'Send the existing promo materials', 'From the Foundations plan: item C4-A57 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Deanna Smith (Southern University).
When: No date yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a57', null, 'todo', 'normal', array['Deanna Smith']::text[], array[]::text[], 91),
  ('c4-a58', 'Weekly student Zoom, Thursdays 11:00 AM', 'From the Foundations plan: item C4-A58 (C4 · Launch countdown: wrap, marquee and invitations).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Thursdays 11:00 AM, weekly from Oct 22, 2026 until the opening.
Note: First call Thursday Oct 22, 2026 (Phase 1). It continues weekly until the opening date is set (Oct 24, 2026, stated by you); the calendar shows it every Thursday through Dec 31, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a58', null, 'doing', 'normal', array['Lynelle Diolulu', 'Jahnavi', 'Jaden Martin', 'Samuel']::text[], array[]::text[], 92),
  ('c4-a69', 'Set the new opening date, then confirm the site and the 11:00 AM slot for it', 'From the Foundations plan: item C4-A69 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Southern University (who decides is not named yet).
When: Opening date to be determined.
Waiting on Southern University.
Note: Oct 24, 2026 (stated by you): the opening date is now to be determined. When it is set, the After opening items get real dates again, counting from it.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a69', null, 'todo', 'high', array[]::text[], array[]::text[], 93),
  ('c4-a59', 'Reserve the site in front of the Leon Waters Museum (via Kuala Chambers)', 'From the Foundations plan: item C4-A59 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Deidre Street (Southern University).
When: Oct 21–27, 2026.
Note: Phase 1.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a59', '2026-10-27'::date, 'doing', 'normal', array['Deidre Street']::text[], array[]::text[], 94),
  ('c4-a60', 'Campus logistics finalized: setup, podium, sound, ribbon and refreshments', 'From the Foundations plan: item C4-A60 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Deidre Street, with campus staff.
When: Nov 4–10, 2026.
Note: Phase 3.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a60', '2026-11-10'::date, 'todo', 'normal', array['Deidre Street', 'Campus staff']::text[], array[]::text[], 95),
  ('c4-a61', 'Press and VIP RSVPs finalized', 'From the Foundations plan: item C4-A61 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Week before opening (date to be set).
Note: Phase 4, the week before opening (dates to be set). Owner not named yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a61', null, 'todo', 'normal', array[]::text[], array[]::text[], 96),
  ('c4-a62', 'Program walkthrough', 'From the Foundations plan: item C4-A62 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: 2 days before opening (date to be set).
Note: Phase 4, the week before opening (dates to be set). Owner not named yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a62', null, 'todo', 'normal', array[]::text[], array[]::text[], 97),
  ('c4-a63', 'Truck positioned and tested at the Leon Waters Museum', 'From the Foundations plan: item C4-A63 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Day before opening (date to be set).
Note: Phase 4, the week before opening (dates to be set). Owner not named yet.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a63', null, 'todo', 'normal', array[]::text[], array[]::text[], 98),
  ('c4-a64', 'Ribbon cutting: Chancellor Dr. Stubblefield, Dr. Tulula, Deidre Street and student leader Jaden Martin', 'From the Foundations plan: item C4-A64 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Opening day.
Note: Phase 5, opening day (date to be determined). In front of the Leon Waters Museum. The 11:00 AM time is to be confirmed with the new date.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a64', null, 'todo', 'normal', array['Deidre Street', 'Jaden Martin']::text[], array[]::text[], 99),
  ('c4-a65', 'CAVE demos', 'From the Foundations plan: item C4-A65 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Opening day.
Note: Phase 5.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a65', null, 'todo', 'normal', array[]::text[], array[]::text[], 100),
  ('c4-a66', 'Media interviews: spokespeople Jaden Martin and Deidre Street', 'From the Foundations plan: item C4-A66 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Opening day.
Note: Phase 5.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a66', null, 'todo', 'normal', array['Jaden Martin', 'Deidre Street']::text[], array[]::text[], 101),
  ('c4-a67', 'Sponsor networking', 'From the Foundations plan: item C4-A67 (C4 · Launch Day (date to be determined), Leon Waters Museum).
Owner in the plan: Owner not named yet.
When: Opening day.
Note: Phase 5.
Open the plan item: https://immersion-foundations.vercel.app/#c4-a67', null, 'todo', 'normal', array[]::text[], array[]::text[], 102),
  ('c5-a12', 'Six measure areas: recruitment, participation, learning, completion and credentials, employment and retention, sustainability', 'From the Foundations plan: item C5-A12 (C5 · Workforce program measures).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Six areas the program reports on.
Open the plan item: https://immersion-foundations.vercel.app/#c5-a12', null, 'todo', 'normal', array[]::text[], array[]::text[], 103),
  ('c6-a1', 'Secure permission to use and adapt the VR prototype', 'From the Foundations plan: item C6-A1 (C6 · Validate).
Owner in the plan: Owner not named yet.
When: First task.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a1', null, 'todo', 'normal', array[]::text[], array[]::text[], 104),
  ('c6-a2', 'Five sponsor levels', 'From the Foundations plan: item C6-A2 (C6 · Fund).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Founding Additive Manufacturing Partner, Advanced Manufacturing Lab Sponsor, VR Technology Sponsor, Student Training Sponsor, Community Maker Sponsor.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a2', null, 'todo', 'normal', array[]::text[], array[]::text[], 105),
  ('c6-a3', 'Outreach targets', 'From the Foundations plan: item C6-A3 (C6 · Fund).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Stratasys, Formlabs, HP; BASF, Dow, ExxonMobil; Autodesk, Dassault Systèmes; Meta and Unity ecosystem providers; regional manufacturers; colleges.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a3', null, 'todo', 'normal', array[]::text[], array[]::text[], 106),
  ('c6-a4', 'Grant channels', 'From the Foundations plan: item C6-A4 (C6 · Fund).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: NSF, U.S. DOL, U.S. ED, Louisiana Workforce Commission, MEP network, foundations.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a4', null, 'todo', 'normal', array[]::text[], array[]::text[], 107),
  ('c6-a5', 'Eight-module blended curriculum', 'From the Foundations plan: item C6-A5 (C6 · Build).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: 1 Introduction to Additive Manufacturing · 2 Printer Components (existing VR tutorial) · 3 Workplace and Equipment Safety · 4 Digital Design Fundamentals · 5 Print Preparation · 6 Print Job Operations (existing VR simulation) · 7 Quality Control and Troubleshooting · 8 Applied Manufacturing Project.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a5', null, 'todo', 'normal', array[]::text[], array[]::text[], 108),
  ('c6-a6', 'Introductory course', 'From the Foundations plan: item C6-A6 (C6 · Build).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Classroom and digital work, VR practice, supervised equipment time, then assessment and career planning.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a6', null, 'todo', 'normal', array[]::text[], array[]::text[], 109),
  ('c6-a7', 'Pilot, months 7–9', 'From the Foundations plan: item C6-A7 (C6 · Pilot).
Owner in the plan: Owner not named yet.
When: Months 7–9.
Parked in the plan (on hold for now).
Open the plan item: https://immersion-foundations.vercel.app/#c6-a7', null, 'todo', 'normal', array[]::text[], array[]::text[], 110),
  ('c6-a8', 'Record VR completion separately from instructor-verified hands-on competency', 'From the Foundations plan: item C6-A8 (C6 · Evaluate).
Owner in the plan: Owner not named yet.
When: No date yet.
Parked in the plan (on hold for now).
Note: Completion is not professional certification.
Open the plan item: https://immersion-foundations.vercel.app/#c6-a8', null, 'todo', 'normal', array[]::text[], array[]::text[], 111),
  ('c7-a1', 'Build the national media list: four groups, about 32 outlets', 'From the Foundations plan: item C7-A1 (C7 · Outlet lists and story angles).
Owner in the plan: Owner not named yet.
When: Oct 21–27, 2026.
Note: Four outlet groups, eight outlets each.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a1', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 112),
  ('c7-a2', 'Find the education, workforce or tech reporter at each outlet', 'From the Foundations plan: item C7-A2 (C7 · Outlet lists and story angles).
Owner in the plan: Owner not named yet.
When: Oct 21–27, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a2', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 113),
  ('c7-a3', 'Write one angle per outlet group', 'From the Foundations plan: item C7-A3 (C7 · Outlet lists and story angles).
Owner in the plan: Owner not named yet.
When: Oct 21–27, 2026.
Note: The origin story uses the credit line.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a3', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array[]::text[], 114),
  ('c7-a4', 'Get written approval of the release, names, logos, photos and quotes', 'From the Foundations plan: item C7-A4 (C7 · Outlet lists and story angles).
Owner in the plan: Owner not named yet.
When: Oct 28 – Nov 3, 2026.
Note: Needed from Southern University and the CAAV before any national pitch.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a4', '2026-11-03'::date, 'todo', 'high', array[]::text[], array[]::text[], 115),
  ('c7-a5', 'Write the national release and fact sheet', 'From the Foundations plan: item C7-A5 (C7 · National release and press kit).
Owner in the plan: Owner not named yet.
When: Oct 28 – Nov 3, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a5', '2026-11-03'::date, 'todo', 'normal', array[]::text[], array[]::text[], 116),
  ('c7-a6', 'Cut a 60-second B-roll reel from the workforce films', 'From the Foundations plan: item C7-A6 (C7 · National release and press kit).
Owner in the plan: Owner not named yet.
When: Oct 28 – Nov 3, 2026.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a6', '2026-11-03'::date, 'todo', 'normal', array[]::text[], array[]::text[], 117),
  ('c7-a7', 'Online press room on the Immersion in Motion site', 'From the Foundations plan: item C7-A7 (C7 · National release and press kit).
Owner in the plan: Owner not named yet.
When: Nov 4–10, 2026.
Note: Release, fact sheet, photos, B-roll and a media contact.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a7', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 118),
  ('c7-a8', 'Wave 1: embargoed pitch to education, HBCU and trade press', 'From the Foundations plan: item C7-A8 (C7 · Pitch waves).
Owner in the plan: Owner not named yet.
When: Nov 4–10, 2026.
Note: Embargo lifts on opening day (date to be determined).
Open the plan item: https://immersion-foundations.vercel.app/#c7-a8', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array[]::text[], 119),
  ('c7-a9', 'Wave 2: national desks, with a remote demo or interview offer', 'From the Foundations plan: item C7-A9 (C7 · Pitch waves).
Owner in the plan: Owner not named yet.
When: Week before opening (date to be set).
Open the plan item: https://immersion-foundations.vercel.app/#c7-a9', null, 'todo', 'normal', array[]::text[], array[]::text[], 120),
  ('c7-a10', 'Release on the wire at the grand opening', 'From the Foundations plan: item C7-A10 (C7 · Pitch waves).
Owner in the plan: Owner not named yet.
When: Opening day.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 121),
  ('c7-a11', 'Wave 3: recap, footage and people stories to every outlet that replied', 'From the Foundations plan: item C7-A11 (C7 · Pitch waves).
Owner in the plan: Owner not named yet.
When: Weeks 1–2 after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a11', null, 'todo', 'normal', array[]::text[], array[]::text[], 122),
  ('c7-a12', 'Wave 4: results story', 'From the Foundations plan: item C7-A12 (C7 · Pitch waves).
Owner in the plan: Owner not named yet.
When: About 3–4 weeks after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a12', null, 'todo', 'normal', array[]::text[], array[]::text[], 123),
  ('c7-a13', 'Pitch and coverage log', 'From the Foundations plan: item C7-A13 (C7 · Coverage tracking).
Owner in the plan: Owner not named yet.
When: Nov 4, 2026 onward.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a13', '2026-11-04'::date, 'todo', 'normal', array[]::text[], array[]::text[], 124),
  ('c7-a14', 'Coverage report', 'From the Foundations plan: item C7-A14 (C7 · Coverage tracking).
Owner in the plan: Owner not named yet.
When: About 10 weeks after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c7-a14', null, 'todo', 'normal', array[]::text[], array[]::text[], 125),
  ('c8-a1', 'Module 1: the staff dashboard (Team tasks, Leads, Uploads, Activity log, Partner resources)', 'From the Foundations plan: item C8-A1 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Oct 27, 2026.
Note: Dashboard: caav-website.vercel.app/dashboard. Proposed date: confirm.
Track B teaching module 1: The staff dashboard. Learn: Team tasks, Leads, Uploads, Activity log and the Partner resources screen at caav-website.vercel.app/dashboard. Sessions: 1 teach session (2 hours) and 1 practice session (2 hours). Learners: XR Jags student team and XR Jags staff.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a1', '2026-10-27'::date, 'todo', 'normal', array[]::text[], array['Check: Adds a task, logs a lead, uploads a file and writes an Activity log entry without help.']::text[], 126),
  ('c8-a2', 'Module 2: the Marketing Engine (Facebook and LinkedIn posts, with approval)', 'From the Foundations plan: item C8-A2 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Nov 3, 2026.
Note: www.missionmetricsmarketingsolutions.com. Builds on the student social strategy (C4-A41). Proposed date: confirm.
Track B teaching module 2: The Marketing Engine. Learn: Draft Facebook and LinkedIn posts at www.missionmetricsmarketingsolutions.com and send them for approval. Nothing posts without approval. Sessions: 1 teach session and 1 practice session. Learners: XR Jags student team (Jahnavi leads social media) and XR Jags staff.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a2', '2026-11-03'::date, 'todo', 'normal', array[]::text[], array['Check: Drafts one post per platform and gets it approved.']::text[], 127),
  ('c8-a3', 'Module 3: partner resources and agreements (NDA, MOU, MOA, sponsor agreement)', 'From the Foundations plan: item C8-A3 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Nov 10, 2026.
Note: How to record what each partner offers and delivers, with dates, and where each NDA and MOU stands. Proposed date: confirm.
Track B teaching module 3: Partner resources and agreements. Learn: Record what each partner offers and delivers, with dates, and where each NDA and MOU stands. Sessions: 1 teach session and 1 practice session. Learners: XR Jags staff and the student leads.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a3', '2026-11-10'::date, 'todo', 'normal', array[]::text[], array['Check: Logs one partner resource with all eight fields and reads the agreement tracker correctly.']::text[], 128),
  ('c8-a4', 'Module 4: run the Mobile CAVE (start-up, shut-down, power, safety)', 'From the Foundations plan: item C8-A4 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Nov 17, 2026.
Note: Ask MechDyne to teach this under its MOU (C8-A23).
Track B teaching module 4: Run the Mobile CAVE. Learn: Start-up and shut-down, generator and shore power, safety checks, guests in and out. Sessions: 1 teach session and 2 practice sessions in the truck. Learners: The demo team (XR Jags student team).
Open the plan item: https://immersion-foundations.vercel.app/#c8-a4', '2026-11-17'::date, 'todo', 'normal', array[]::text[], array['Check: Starts and shuts down the CAVE safely on both power sources.']::text[], 129),
  ('c8-a5', 'Module 5: care and maintenance (daily checks, cleaning headsets, updates, backups, issue log)', 'From the Foundations plan: item C8-A5 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Dec 1, 2026.
Note: Issues go in the dashboard Activity log.
Track B teaching module 5: Care and maintenance. Learn: Daily checks, cleaning headsets, software updates, backups to the rugged drives, and the issue log. Sessions: 1 teach session and 1 practice session. Learners: The demo team.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a5', '2026-12-01'::date, 'todo', 'normal', array[]::text[], array['Check: Runs the daily check list, makes a backup and logs one issue in the Activity log.']::text[], 130),
  ('c8-a6', 'Module 6: content (load and run the demo scenarios; pick the one that answers the barrier)', 'From the Foundations plan: item C8-A6 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Dec 8, 2026.
Note: Confirm a scenario exists before a demo is promised (C2-A6).
Track B teaching module 6: Content. Learn: Load and run the demo scenarios. Pick the one that answers the guest''s barrier. Never promise a scenario that does not exist. Sessions: 1 teach session and 1 practice session. Learners: The demo team.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a6', '2026-12-08'::date, 'todo', 'normal', array[]::text[], array['Check: Runs two scenarios without help.']::text[], 131),
  ('c8-a7', 'Module 7: give the 20-minute demo (barrier question, sign-in, 48-hour follow-up)', 'From the Foundations plan: item C8-A7 (C8 · Teaching plan).
Owner in the plan: Mission Metrics.
When: Tue Dec 15, 2026.
Note: Same demo as E1 (C2-O3).
Track B teaching module 7: Give the 20-minute demo. Learn: The barrier question first, the demo, every guest signs in, the 48-hour follow-up with a pilot offer. Sessions: 1 teach session and 2 practice demos. Learners: The demo team.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a7', '2026-12-15'::date, 'todo', 'normal', array[]::text[], array['Check: Gives a full demo to a practice group, with sign-ins captured.']::text[], 132),
  ('c8-a8', 'Readiness check: each learner runs a full demo, watched, twice', 'From the Foundations plan: item C8-A8 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Thu Dec 17, 2026.
Note: Pass marks go in the dashboard Team tasks. Only checked members join a demo team.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a8', '2026-12-17'::date, 'todo', 'normal', array[]::text[], array[]::text[], 133),
  ('c8-a26', 'Module 8: train the trainer (checked student leads teach Modules 4 to 7)', 'From the Foundations plan: item C8-A26 (C8 · Teaching plan).
Owner in the plan: Owner not named yet.
When: Tue Jan 12, 2027.
Note: Proposed owner and date: confirm.
Track B teaching module 8: Train the trainer. Learn: Checked student leads teach Modules 4 to 7 to the next demo team, using the run book. Sessions: Modules 4 to 7 again, taught by the student leads. Learners: New demo team members.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a26', '2027-01-12'::date, 'todo', 'normal', array[]::text[], array['Check: The new members pass the same readiness check.']::text[], 134),
  ('c8-a9', 'Second demo team trained by the student leads and readiness-checked', 'From the Foundations plan: item C8-A9 (C8 · Scale up).
Owner in the plan: Owner not named yet.
When: Tue Feb 9, 2027.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a9', '2027-02-09'::date, 'todo', 'normal', array[]::text[], array[]::text[], 135),
  ('c8-a10', 'Pick the next host sites (schools, plants, parishes) with program partners', 'From the Foundations plan: item C8-A10 (C8 · Scale up).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Uses the program-partner goals (C8-A20).
Open the plan item: https://immersion-foundations.vercel.app/#c8-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 136),
  ('c8-a11', 'Write the run book: one page per module, kept in the dashboard Uploads', 'From the Foundations plan: item C8-A11 (C8 · Scale up).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: So a new team can learn without the first teachers.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a11', null, 'todo', 'normal', array[]::text[], array[]::text[], 137),
  ('c8-a12', 'Partner resources screen in the XR Jags staff dashboard', 'From the Foundations plan: item C8-A12 (C8 · Partner resources log).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Being added to caav-website.vercel.app/dashboard. Fields: partner, type (resource / sponsorship / partnership), what they offered, what was delivered, date offered, date deployed, status, agreement on file.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a12', null, 'doing', 'normal', array[]::text[], array[]::text[], 138),
  ('c8-a13', 'Log every partner offer and every delivery, with dates', 'From the Foundations plan: item C8-A13 (C8 · Partner resources log).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Ongoing. One row per resource.
Partner step "Log and report": Every offer and delivery goes in the Partner resources log; a results note each quarter.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a13', null, 'todo', 'normal', array[]::text[], array[]::text[], 139),
  ('c8-a14', 'Monthly review: offered against delivered, and the date timeline of each partner''s resources', 'From the Foundations plan: item C8-A14 (C8 · Partner resources log).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Feeds the quarterly results note (C3-A15).
Open the plan item: https://immersion-foundations.vercel.app/#c8-a14', null, 'todo', 'normal', array[]::text[], array[]::text[], 140),
  ('c8-a15', 'Get a written quote for every priced line', 'From the Foundations plan: item C8-A15 (C8 · Capacity budget).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Market prices checked Oct 24, 2026. A quote replaces each one.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a15', null, 'todo', 'normal', array[]::text[], array[]::text[], 141),
  ('c8-a16', 'Find a price for every line marked Price needed', 'From the Foundations plan: item C8-A16 (C8 · Capacity budget).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: CAVE software and support, maintenance, parking, stipends, boosted posts, demo-day costs, admin.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a16', null, 'todo', 'normal', array[]::text[], array[]::text[], 142),
  ('c8-a17', 'Match each budget line to a partner ask', 'From the Foundations plan: item C8-A17 (C8 · Capacity budget).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Each line names its ask.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a17', null, 'todo', 'normal', array[]::text[], array[]::text[], 143),
  ('c8-a18', 'Resource partners: 1 signed MOU (MechDyne) and every promised resource logged as delivered', 'From the Foundations plan: item C8-A18 (C8 · Partner goals by type).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Note: Lynelle Diolulu is the MechDyne contact (C4-A56). Timeline: NDA first, MOU before the opening.
Partner goal, Resource partners: ask Equipment, software, technical support and training for the demo team. Matched to budget lines such as CAVE software and support, computers and connectivity. Target: 1 signed MOU (MechDyne) before the opening. Every promised resource logged as delivered, with its date.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a18', null, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 144),
  ('c8-a19', 'Sponsors: 3 sponsor commitments, each with a signed sponsor agreement', 'From the Foundations plan: item C8-A19 (C8 · Partner goals by type).
Owner in the plan: Mission Metrics.
When: No date yet.
Note: Same target as C3-A10, now announced at the opening.
Partner goal, Sponsors: ask A tier: exterior truck branding ($10,000+, multi-year), interior wall and equipment, software module pop-ups or classroom VR headsets. Amounts only as the project director gives them. Target: 3 sponsor commitments, each with a signed sponsor agreement, announced at the opening.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a19', null, 'todo', 'normal', array[]::text[], array[]::text[], 145),
  ('c8-a20', 'Program partners: 3 partners with a signed MOU and a booked demo in the first month after opening', 'From the Foundations plan: item C8-A20 (C8 · Partner goals by type).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: For example Nexus Louisiana and the schools on Deidre Street''s lists (EBR, Helix, Southern Lab).
Partner goal, Program partners: ask Host a demo, bring learners, share their network. Target: 3 program partners with a signed MOU and a booked demo in the first month after opening.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a20', null, 'todo', 'normal', array[]::text[], array[]::text[], 146),
  ('c8-a21', 'NDA signed with each potential partner before detailed talks or sharing plans or budgets', 'From the Foundations plan: item C8-A21 (C8 · Agreements: NDA, MOU, MOA and sponsor agreement).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Oct 24, 2026 (stated by you): an NDA for each potential partner. The tracker shows NDA status for every partner.
Partner step "NDA signed": Mutual non-disclosure agreement, signed before detailed talks or before any plan, budget or price is shared. A first 20-minute conversation can come before it.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a21', null, 'todo', 'high', array[]::text[], array[]::text[], 147),
  ('c8-a22', 'MOU with each potential partner, after the NDA', 'From the Foundations plan: item C8-A22 (C8 · Agreements: NDA, MOU, MOA and sponsor agreement).
Owner in the plan: Owner not named yet.
When: No date yet.
Note: Oct 24, 2026 (stated by you): an MOU for potential partners.
Partner step "MOU signed": Who does what, what the partner offers and what it gets. Not binding on money.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a22', null, 'todo', 'normal', array[]::text[], array[]::text[], 148),
  ('c8-a23', 'MechDyne MOU: formal MOU, co-branding terms, lead sponsor spot on the truck', 'From the Foundations plan: item C8-A23 (C8 · Agreements: NDA, MOU, MOA and sponsor agreement).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: No date yet.
Note: NDA first, then the MOU. Uses the MOU template on the Agreements page.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a23', null, 'todo', 'normal', array['Lynelle Diolulu']::text[], array['MechDyne: NDA, then the formal MOU with co-branding terms (C8-A23).']::text[], 149),
  ('c8-a24', 'Southern University legal / sponsored programs office reviews the four draft templates', 'From the Foundations plan: item C8-A24 (C8 · Agreements: NDA, MOU, MOA and sponsor agreement).
Owner in the plan: Owner not named yet.
When: No date yet.
Waiting on Southern University.
Note: Draft templates: NDA, MOU, MOA, sponsor agreement. Nothing is signed before this review.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a24', null, 'todo', 'normal', array[]::text[], array[]::text[], 150),
  ('c8-a25', 'MOA for partners who commit people, money or equipment; a sponsor agreement for each sponsor', 'From the Foundations plan: item C8-A25 (C8 · Agreements: NDA, MOU, MOA and sponsor agreement).
Owner in the plan: Owner not named yet.
When: No date yet.
Partner step "MOA or sponsor agreement": An MOA when the partner commits people, money or equipment on dates. A sponsor agreement for each sponsor tier.
Open the plan item: https://immersion-foundations.vercel.app/#c8-a25', null, 'todo', 'normal', array[]::text[], array[]::text[], 151),
  ('c9-a1', 'Name the demo lead: the person in charge of demos after opening', 'From the Foundations plan: item C9-A1 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: Before the opening.
Note: No one is named for this in the plan or the roles matrix yet.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a1', null, 'todo', 'high', array[]::text[], array[]::text[], 152),
  ('c9-a2', 'Request: every demo request lands in the dashboard Leads', 'From the Foundations plan: item C9-A2 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: From opening day.
Note: From the Book a Tour form (C1-A24) and the booking form (C1-O2).
Track C demo step "Request": Every request from the Book a Tour form or the booking form lands in Leads. Time limit: Same day. Where: Dashboard Leads.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a2', null, 'todo', 'normal', array[]::text[], array[]::text[], 153),
  ('c9-a3', 'Triage within 2 working days: audience, place, power and internet, and a scenario that exists', 'From the Foundations plan: item C9-A3 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: From week 1 after opening.
Note: Confirm the scenario exists before the demo is promised (C2-A6).
Track C demo step "Triage": Audience, place, power and internet, and a scenario that exists. Time limit: Within 2 working days. Where: Dashboard Leads.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a3', null, 'todo', 'normal', array[]::text[], array[]::text[], 154),
  ('c9-a4', 'Assign a demo team: at least two readiness-checked members', 'From the Foundations plan: item C9-A4 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: From week 1 after opening.
Note: Only members who passed the readiness check (C8-A8).
Track C demo step "Assign the demo team": At least two members who passed the readiness check. Time limit: Within 2 working days. Where: Dashboard Team tasks.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a4', null, 'todo', 'normal', array[]::text[], array[]::text[], 155),
  ('c9-a5', 'Confirm date, place, contact and set-up needs in writing; NDA first if the guest is a potential partner', 'From the Foundations plan: item C9-A5 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: From week 1 after opening.
Track C demo step "Confirm": Date, place, contact and set-up needs in writing. NDA first if the guest is a potential partner. Time limit: At least 5 working days before. Where: Email, logged in Activity log.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a5', null, 'todo', 'normal', array[]::text[], array[]::text[], 156),
  ('c9-a6', 'Run the 20-minute demo. Every guest signs in', 'From the Foundations plan: item C9-A6 (C9 · Demo scheduling).
Owner in the plan: Owner not named yet.
When: From week 1 after opening.
Note: Once they pass the readiness check.
Track C demo step "Run": The barrier question, the demo, every guest signs in. Time limit: 20 minutes. Where: Sign-in sheet or tablet.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a6', null, 'todo', 'normal', array[]::text[], array[]::text[], 157),
  ('c9-a7', 'Follow up within 48 hours with a pilot offer; log it in Leads', 'From the Foundations plan: item C9-A7 (C9 · Demo scheduling).
Owner in the plan: Mission Metrics.
When: Within 48 hours of each demo.
Note: Same as C2-A7 and C2-A9.
Track C demo step "Follow up": Thank-you, the pilot offer, and the next step logged. Time limit: Within 48 hours. Where: Dashboard Leads.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a7', null, 'todo', 'normal', array[]::text[], array[]::text[], 158),
  ('c9-a8', 'Week 1 after opening: follow-up demos for opening-day sign-ins', 'From the Foundations plan: item C9-A8 (C9 · Demo calendar pattern).
Owner in the plan: Owner not named yet.
When: Week 1 after opening.
Track C pattern, Week 1 after opening: Follow-up demos for opening-day sign-ins.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a8', null, 'todo', 'normal', array[]::text[], array[]::text[], 159),
  ('c9-a9', 'Every Tuesday: on-site demos at partner sites, by request', 'From the Foundations plan: item C9-A9 (C9 · Demo calendar pattern).
Owner in the plan: Owner not named yet.
When: Weekly, from week 2 after opening.
Track C pattern, Every Tuesday: On-site demos at partner sites, by request.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a9', null, 'todo', 'normal', array[]::text[], array[]::text[], 160),
  ('c9-a10', 'Every Thursday afternoon: campus demo hour with open booking', 'From the Foundations plan: item C9-A10 (C9 · Demo calendar pattern).
Owner in the plan: Owner not named yet.
When: Weekly, from week 2 after opening.
Note: Afternoon, so it does not clash with the 11:00 AM Thursday student Zoom while that runs.
Track C pattern, Every Thursday afternoon: Campus demo hour, open booking.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a10', null, 'todo', 'normal', array[]::text[], array[]::text[], 161),
  ('c9-a11', 'Monthly: partner demo day for resource partners and sponsors (NDA signed first)', 'From the Foundations plan: item C9-A11 (C9 · Demo calendar pattern).
Owner in the plan: Owner not named yet.
When: Monthly, from week 4 after opening.
Note: Proposed owner: confirm.
Track C pattern, Monthly: Partner demo day for resource partners and sponsors (NDA signed first).
Open the plan item: https://immersion-foundations.vercel.app/#c9-a11', null, 'todo', 'normal', array[]::text[], array[]::text[], 162),
  ('c9-a12', 'Quarterly: co-hosted demo day with a program partner, plus the results note', 'From the Foundations plan: item C9-A12 (C9 · Demo calendar pattern).
Owner in the plan: Mission Metrics.
When: Quarterly after opening.
Note: Builds on C3-A14 and C3-A15.
Track C pattern, Quarterly: Co-hosted demo day with a program partner, and the results note.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a12', null, 'todo', 'normal', array[]::text[], array[]::text[], 163),
  ('c9-a13', 'Step 1: NDA signed before the private demo and before any plan or budget is shared', 'From the Foundations plan: item C9-A13 (C9 · Market demos to resource partners).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Before each partner demo.
Note: Oct 24, 2026 (stated by you).
Open the plan item: https://immersion-foundations.vercel.app/#c9-a13', null, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 164),
  ('c9-a14', 'Step 2: invite the named prospects to a private partner demo: MechDyne, Nexus Louisiana, B1 Bank (Will Campbell), Councilman Anthony Kenny, Kermit Johnson, Rinaldi Jacobs, the Mayor''s Office', 'From the Foundations plan: item C9-A14 (C9 · Market demos to resource partners).
Owner in the plan: Lynelle Diolulu (Mission Metrics).
When: Weeks 2–6 after opening.
Note: Names from the VIP and industry partner lists (C4-A54, C4-A56). No contact details are kept here.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a14', null, 'todo', 'normal', array['Lynelle Diolulu']::text[], array[]::text[], 165),
  ('c9-a15', 'Step 3: one resource ask per partner, matched to a capacity budget line', 'From the Foundations plan: item C9-A15 (C9 · Market demos to resource partners).
Owner in the plan: Owner not named yet.
When: At each partner demo.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a15', null, 'todo', 'normal', array[]::text[], array[]::text[], 166),
  ('c9-a16', 'Step 4: MOU signed; then log what they offer and what they deliver', 'From the Foundations plan: item C9-A16 (C9 · Market demos to resource partners).
Owner in the plan: Owner not named yet.
When: After each partner demo.
Note: Goes in the Partner resources log (C8-O3).
Open the plan item: https://immersion-foundations.vercel.app/#c9-a16', null, 'todo', 'normal', array[]::text[], array[]::text[], 167),
  ('c9-a17', 'Step 5: a short demo clip for partner prospects, posted through the Marketing Engine with approval', 'From the Foundations plan: item C9-A17 (C9 · Market demos to resource partners).
Owner in the plan: Owner not named yet.
When: Monthly after opening.
Note: No partner is named in a post until they approve it in writing.
Open the plan item: https://immersion-foundations.vercel.app/#c9-a17', null, 'todo', 'normal', array[]::text[], array[]::text[], 168);

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
