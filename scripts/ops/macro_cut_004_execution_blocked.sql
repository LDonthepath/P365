-- MACRO-CUT-004 / issue #455: this is an intentional **execution blocker**, not an APPLY migration.
-- It contains NO DELETE, UPDATE, TRUNCATE, DROP, cron.alter_job, cron.unschedule or cron.schedule.
-- Merging or running this file never grants consent to data/cron mutation.
-- Before ANY future DML: verified offsite pg_dump -Fc, SHA-256, full isolated restore,
-- referential/revision closure, exact candidate-ID manifest, owner literal
-- SETUJU HAPUS <kelompok>, and independently reviewed rollback plan are required.
DO $macro_cut_004_stop$
BEGIN
  RAISE EXCEPTION 'MACRO-CUT-004 BLOCKED: no verified full backup/restore, source-group approval, or closed Snapshot/Context references. Do not change production cron or Market Memory.';
END;
$macro_cut_004_stop$;
