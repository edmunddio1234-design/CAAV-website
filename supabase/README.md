# Southern database (Supabase project southern-xr-jags, ykdyzsoukftzyfxfchoe)

Record of what is applied to the live database, in order. All applied 2026-10-24.

1. `migration.sql` Block 1: staff, leads, activity_log. Do NOT re-run (its is_staff() is the old version; Block 3 replaces it).
2. `migration-uploads.sql`: private uploads bucket + uploads table.
3. `migration-tasks.sql`: team tasks, checklist, updates, history, notifications, password flag. (Live copy was applied without its drop-if-exists lines.)
4. `migration-partners.sql`: partners + partner_resources with NDA/MOU tracking.
5. `migration-budget.sql`: plan_budget, saved prices for the Foundations plan.

`functions/admin-members/index.ts` is the live Edge Function behind "Add member" (deployed with verify_jwt off; it checks the token itself).
No secrets live in this folder. The publishable key in assets/su-config.js is meant to be public.
