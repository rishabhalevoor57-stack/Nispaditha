import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLES_TO_BACKUP = [
  'business_settings',
  'categories',
  'clients',
  'products',
  'invoices',
  'invoice_items',
  'order_notes',
  'order_note_items',
  'order_note_payments',
  'custom_orders',
  'custom_order_items',
  'expenses',
  'suppliers',
  'vendor_payments',
  'return_exchanges',
  'return_exchange_items',
  'calendar_events',
  'rate_history',
  'stock_history',
  'stores',
  'product_store_quantities',
  'stock_transfers',
  'types_of_work',
  'profiles',
  'user_roles',
  'activity_logs',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const backupType = body.backup_type || 'manual';
    const notes = body.notes || '';

    // Create backup record
    const { data: backupRecord, error: insertErr } = await adminClient
      .from('backups')
      .insert({
        backup_type: backupType,
        status: 'pending',
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Export all tables
    const backupData: Record<string, unknown[]> = {};
    const tablesIncluded: string[] = [];

    for (const table of TABLES_TO_BACKUP) {
      const { data, error } = await adminClient
        .from(table)
        .select('*')
        .limit(10000);

      if (!error && data) {
        backupData[table] = data;
        tablesIncluded.push(table);
      }
    }

    // Create JSON file
    const backupJson = JSON.stringify({
      metadata: {
        created_at: new Date().toISOString(),
        backup_id: backupRecord.id,
        backup_type: backupType,
        tables: tablesIncluded,
        total_records: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      },
      data: backupData,
    }, null, 2);

    const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = `${fileName}`;

    // Upload to storage
    const { error: uploadErr } = await adminClient.storage
      .from('backups')
      .upload(filePath, new Blob([backupJson], { type: 'application/json' }), {
        contentType: 'application/json',
      });

    if (uploadErr) throw uploadErr;

    // Update backup record
    const fileSize = new Blob([backupJson]).size;
    await adminClient
      .from('backups')
      .update({
        status: 'completed',
        file_path: filePath,
        file_size: fileSize,
        tables_included: tablesIncluded,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupRecord.id);

    return new Response(JSON.stringify({
      success: true,
      backup_id: backupRecord.id,
      file_path: filePath,
      file_size: fileSize,
      tables_count: tablesIncluded.length,
      total_records: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
