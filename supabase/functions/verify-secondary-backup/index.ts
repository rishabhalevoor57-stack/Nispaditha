import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const primaryUrl = Deno.env.get('SUPABASE_URL')!;
  const primaryKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(primaryUrl, primaryKey);

  let secondaryUrl = Deno.env.get('SECONDARY_SUPABASE_URL');
  const secondaryKey = Deno.env.get('SECONDARY_SUPABASE_SERVICE_ROLE_KEY');
  if (secondaryUrl && !/^https?:\/\//i.test(secondaryUrl)) {
    secondaryUrl = `https://${secondaryUrl.replace(/^\/+/, '')}`;
  }
  secondaryUrl = secondaryUrl?.replace(/\/+$/, '');

  let status = 'ok';
  let reachable = false;
  let fileCount: number | null = null;
  let lastFile: string | null = null;
  let errorMsg: string | null = null;

  if (!secondaryUrl || !secondaryKey) {
    status = 'not_configured';
    errorMsg = 'Secondary Supabase credentials are not set.';
  } else {
    try {
      const secondary = createClient(secondaryUrl, secondaryKey);
      const { data, error } = await secondary.storage.from('backups').list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) {
        status = 'unreachable';
        errorMsg = error.message;
      } else {
        reachable = true;
        fileCount = data?.length ?? 0;
        lastFile = data?.[0]?.name ?? null;

        // Cross-check: latest primary backup should also exist in secondary
        const { data: latestPrimary } = await admin
          .from('backups')
          .select('file_path, created_at')
          .eq('status', 'completed')
          .not('file_path', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPrimary?.file_path) {
          const found = data?.some((f) => f.name === latestPrimary.file_path);
          if (!found) {
            status = 'mirror_missing';
            errorMsg = `Latest primary backup ${latestPrimary.file_path} not found in secondary bucket.`;
          }
        }
      }
    } catch (e) {
      status = 'error';
      errorMsg = e instanceof Error ? e.message : String(e);
    }
  }

  await admin.from('backup_mirror_status').insert({
    status,
    reachable,
    file_count: fileCount,
    last_backup_file: lastFile,
    error_message: errorMsg,
    source: 'scheduled',
  });

  return new Response(
    JSON.stringify({ status, reachable, file_count: fileCount, last_backup_file: lastFile, error: errorMsg }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
