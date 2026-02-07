import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityLog {
  id: string;
  module: string;
  action: string;
  record_id: string | null;
  record_label: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

interface ActivityLogFilters {
  module: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  admin: string;
}

export function useActivityLogger() {
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setUserName(data?.full_name || user.email || 'Unknown');
        });
    }
  }, [user]);

  const logActivity = useCallback(async (params: {
    module: string;
    action: string;
    recordId?: string;
    recordLabel?: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
  }) => {
    try {
      await supabase.from('activity_logs').insert([{
        module: params.module,
        action: params.action,
        record_id: params.recordId || null,
        record_label: params.recordLabel || null,
        old_value: params.oldValue as import('@/integrations/supabase/types').Json || null,
        new_value: params.newValue as import('@/integrations/supabase/types').Json || null,
        user_id: user?.id || null,
        user_name: userName || user?.email || 'Unknown',
      }]);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }, [user, userName]);

  return { logActivity };
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ActivityLogFilters>({
    module: 'all',
    action: 'all',
    dateFrom: '',
    dateTo: '',
    admin: 'all',
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.module !== 'all') {
        query = query.eq('module', filters.module);
      }
      if (filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom + 'T00:00:00');
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }
      if (filters.admin !== 'all') {
        query = query.eq('user_name', filters.admin);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as ActivityLog[]) || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const adminNames = useMemo(() => {
    const names = new Set(logs.map(l => l.user_name).filter(Boolean));
    return Array.from(names) as string[];
  }, [logs]);

  return {
    logs,
    isLoading,
    filters,
    setFilters,
    adminNames,
    refresh: fetchLogs,
  };
}
