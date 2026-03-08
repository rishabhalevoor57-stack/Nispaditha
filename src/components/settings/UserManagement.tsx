import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, Loader2 } from 'lucide-react';

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'staff';
}

const MAX_ADMINS = 5;

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, email, full_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];

      const roleMap = new Map(roles.map(r => [r.user_id, r.role as 'admin' | 'staff']));

      const merged: UserWithRole[] = profiles.map(p => ({
        user_id: p.user_id,
        email: p.email || '',
        full_name: p.full_name,
        role: roleMap.get(p.user_id) || 'staff',
      }));

      setUsers(merged);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const adminCount = users.filter(u => u.role === 'admin').length;

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'staff') => {
    if (newRole === 'admin' && adminCount >= MAX_ADMINS) {
      toast({ variant: 'destructive', title: 'Limit reached', description: `Maximum ${MAX_ADMINS} admins allowed.` });
      return;
    }

    if (userId === user?.id && newRole === 'staff') {
      toast({ variant: 'destructive', title: 'Cannot demote yourself', description: 'You cannot remove your own admin access.' });
      return;
    }

    setSavingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      toast({ title: `Role updated to ${newRole}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingUserId(null);
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
          Manage user roles. Admins have full access. Staff can add, view, and update — but cannot delete.
          <br />
          <span className="text-xs font-medium">Admins: {adminCount}/{MAX_ADMINS}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.user_id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                {u.user_id === user?.id && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {savingUserId === u.user_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Select
                    value={u.role}
                    onValueChange={(val) => handleRoleChange(u.user_id, val as 'admin' | 'staff')}
                    disabled={u.user_id === user?.id}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No users found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
