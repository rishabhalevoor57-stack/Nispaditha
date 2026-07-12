import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, Loader2, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: AppRole;
}

const MAX_ADMINS = 5;

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'sales_staff', label: 'Sales Staff' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'technician', label: 'Technician' },
  { value: 'staff', label: 'Staff' },
];

export const UserManagement = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, email, full_name, is_active'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role as AppRole]));
      setUsers(profiles.map((p: any) => ({
        user_id: p.user_id,
        email: p.email || '',
        full_name: p.full_name,
        is_active: p.is_active !== false,
        role: roleMap.get(p.user_id) || 'staff',
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'super_admin').length;

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const isElevated = newRole === 'admin' || newRole === 'super_admin';
    const target = users.find(u => u.user_id === userId);
    const wasElevated = target && (target.role === 'admin' || target.role === 'super_admin');

    if (isElevated && !wasElevated && adminCount >= MAX_ADMINS) {
      toast({ variant: 'destructive', title: 'Limit reached', description: `Maximum ${MAX_ADMINS} admins allowed.` });
      return;
    }
    if (userId === user?.id && !isElevated) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'You cannot demote yourself.' });
      return;
    }
    if (newRole === 'super_admin' && !isSuperAdmin) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'Only a Super Admin can assign Super Admin.' });
      return;
    }

    setSavingId(userId);
    try {
      // Delete existing role, then insert new one (single active role)
      const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole } as any);
      if (insErr) throw insErr;
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      toast({ title: `Role updated to ${newRole}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleActiveToggle = async (userId: string, next: boolean) => {
    if (userId === user?.id && !next) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'You cannot pause your own account.' });
      return;
    }
    setSavingId(userId);
    try {
      const { error } = await supabase.from('profiles').update({ is_active: next } as any).eq('user_id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: next } : u));
      toast({ title: next ? 'User reactivated' : 'User paused', description: next ? 'They can log in again.' : 'They are signed out and blocked from signing in.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          User Management
        </CardTitle>
        <CardDescription>
          Assign roles, pause access, or review a user's activity. Paused users lose all access immediately.
          <br />
          <span className="text-xs font-medium">Admins: {adminCount}/{MAX_ADMINS}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.user_id === user?.id && <Badge variant="outline" className="text-xs">You</Badge>}
                {!u.is_active && <Badge variant="destructive" className="text-xs">Paused</Badge>}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={u.is_active}
                    disabled={savingId === u.user_id || u.user_id === user?.id}
                    onCheckedChange={(v) => handleActiveToggle(u.user_id, v)}
                  />
                </div>
                <Select
                  value={u.role}
                  onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                  disabled={savingId === u.user_id || u.user_id === user?.id}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(opt => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.value === 'super_admin' && !isSuperAdmin}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => navigate(`/activity-log?user=${encodeURIComponent(u.full_name || u.email)}`)}
                >
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
                {savingId === u.user_id && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-center text-muted-foreground py-8">No users found.</p>}
        </div>
      </CardContent>
    </Card>
  );
};
