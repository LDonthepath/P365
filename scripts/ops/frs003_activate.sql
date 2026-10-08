-- FRS-003 ACTIVE SCHEDULER SPLIT. DO NOT EXECUTE WITHOUT EXPLICIT OWNER APPROVAL.
-- Before execution: PR merged, p365-kappa production READY same SHA, natural
-- legacy HTTP provider success verified, all 33 series policy reviewed.
-- Runs atomically, reuses the existing vault-based authenticated net.http_get
-- command. No plaintext credential appears in this repository.
BEGIN;
DO $activate$
DECLARE
  existing_job cron.job%ROWTYPE;
  fred_command text;
  context_command text;
BEGIN
  SELECT * INTO STRICT existing_job FROM cron.job WHERE jobname = 'p365-fred';
  IF existing_job.jobid <> 4 OR NOT existing_job.active
     OR existing_job.schedule <> '31 * * * *'
     OR existing_job.command NOT LIKE '%net.http_get%'
     OR existing_job.command NOT LIKE '%vault.decrypted_secrets%'
     OR existing_job.command NOT LIKE '%p365-kappa.vercel.app%'
     OR (length(existing_job.command) - length(replace(existing_job.command,
       'providers=fred,coingecko-context', ''))) / length('providers=fred,coingecko-context') <> 1
     OR EXISTS (SELECT 1 FROM cron.job WHERE jobname='p365-fred-release-aware')
  THEN
    RAISE EXCEPTION 'FRS-003 activation preflight failed; no schedule changed';
  END IF;

  fred_command := replace(existing_job.command,
    'providers=fred,coingecko-context', 'providers=fred&fredReleaseAware=1');
  context_command := replace(existing_job.command,
    'providers=fred,coingecko-context', 'providers=coingecko-context');
  -- Mutations are protected by a single SQL transaction. The existing
  -- p365-fred job keeps hourly CoinGecko Context and its existing job ID.
  PERFORM cron.alter_job(job_id := existing_job.jobid, command := context_command);
  PERFORM cron.schedule('p365-fred-release-aware', existing_job.schedule, fred_command);
END
$activate$;
COMMIT;
-- AFTER EXECUTION read-only verification (no command/secret printing):
-- SELECT jobid, jobname, schedule, active, position('fredReleaseAware=1' IN command)>0 AS release_aware
-- FROM cron.job WHERE jobname IN ('p365-fred', 'p365-fred-release-aware') ORDER BY jobid;
-- Then verify cron.job_run_details + actual net._http_response provider JSON and
-- Market Memory physical writes on a natural hourly run. Cron "succeeded"
-- means net.http_get queued, not provider ingestion SUCCESS.
