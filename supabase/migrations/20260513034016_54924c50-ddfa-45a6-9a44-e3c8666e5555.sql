DROP TABLE IF EXISTS public.backup_mirror_status CASCADE;
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'verify-secondary-backup-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;