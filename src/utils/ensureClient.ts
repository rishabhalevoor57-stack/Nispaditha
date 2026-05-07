import { supabase } from '@/integrations/supabase/client';

/**
 * Ensure a client row exists for the given phone number.
 * If a phone is provided, upserts (creates or updates name) by phone.
 * No-op if phone is missing.
 */
export async function ensureClient(phone: string | null | undefined, name: string | null | undefined): Promise<void> {
  if (!phone || !phone.trim()) return;
  const cleanPhone = phone.trim();
  const cleanName = (name || 'Walk-in').trim();
  try {
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (existing) {
      if (cleanName && existing.name !== cleanName && cleanName !== 'Walk-in') {
        await supabase.from('clients').update({ name: cleanName }).eq('id', existing.id);
      }
      return;
    }
    await supabase.from('clients').insert({ name: cleanName, phone: cleanPhone });
  } catch (e) {
    console.error('ensureClient failed', e);
  }
}
