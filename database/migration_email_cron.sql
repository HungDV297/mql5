-- Schedule the email queue worker every 15 minutes.
-- Run after deploying process-email-queue.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'process-email-queue-every-15-minutes'
  ) then
    perform cron.unschedule('process-email-queue-every-15-minutes');
  end if;
end $$;

select cron.schedule(
  'process-email-queue-every-15-minutes',
  '*/15 * * * *',
  $$
  select
    net.http_post(
      url := 'https://rhqmzccyvfiitojeqkfr.functions.supabase.co/process-email-queue',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"limit":20}'::jsonb
    );
  $$
);
