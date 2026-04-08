import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Order matters for foreign key constraints - delete in reverse, insert in order
const RESTORE_ORDER = [
  'business_settings',
  'categories',
  'types_of_work',
  'stores',
  'clients',
  'suppliers',
  'products',
  'product_store_quantities',
  'invoices',
  'invoice_items',
  'order_notes',
  'order_note_items',
  'order_note_payments',
  'custom_orders',
  'custom_order_items',
  'expenses',
  'vendor_payments',
  'return_exchanges',
  'return_exchange_items',
  'calendar_events',
  'rate_history',
  'stock_history',
  'stock_transfers',
  'activity_logs',
];

// Tables we should NOT clear during restore (sensitive auth data)
const SKIP_DELETE = ['profiles', 'user_roles'];

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

    const { file_path } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: 'file_path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download backup file
    const { data: fileData, error: downloadErr } = await adminClient.storage
      .from('backups')
      .download(file_path);

    if (downloadErr || !fileData) {
      return new Response(JSON.stringify({ error: 'Failed to download backup file' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const backupContent = JSON.parse(await fileData.text());
    const backupData = backupContent.data;

    if (!backupData) {
      return new Response(JSON.stringify({ error: 'Invalid backup format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const restored: string[] = [];
    const errors: string[] = [];

    // Delete existing data in reverse order
    const deleteOrder = [...RESTORE_ORDER].reverse();
    for (const table of deleteOrder) {
      if (SKIP_DELETE.includes(table)) continue;
      try {
        await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        // Some tables might not have data, that's fine
      }
    }

    // Insert data in correct order
    for (const table of RESTORE_ORDER) {
      if (!backupData[table] || backupData[table].length === 0) continue;
      if (SKIP_DELETE.includes(table)) continue;

      try {
        // Insert in batches of 500
        const rows = backupData[table];
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await adminClient.from(table).insert(batch);
          if (error) {
            errors.push(`${table}: ${error.message}`);
            break;
          }
        }
        restored.push(table);
      } catch (e) {
        errors.push(`${table}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      restored_tables: restored,
      errors: errors.length > 0 ? errors : undefined,
      message: `Restored ${restored.length} tables. ${errors.length} errors.`,
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
