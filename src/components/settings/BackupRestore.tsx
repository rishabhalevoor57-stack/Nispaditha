import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  Upload,
  Loader2,
  Shield,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Backup {
  id: string;
  backup_type: string;
  file_path: string | null;
  file_size: number;
  status: string;
  notes: string | null;
  tables_included: string[] | null;
  created_at: string;
  completed_at: string | null;
}

export const BackupRestore = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBackups((data as unknown as Backup[]) || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBackup = async () => {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/create-backup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            backup_type: 'manual',
            notes: notes.trim() || 'Manual backup',
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Backup failed');

      toast({
        title: 'Backup created successfully!',
        description: `${result.tables_count} tables backed up with ${result.total_records} total records.`,
      });
      setNotes('');
      fetchBackups();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Backup Failed', description: message });
    } finally {
      setIsCreating(false);
    }
  };

  const restoreBackup = async (backup: Backup) => {
    if (restoreConfirmText !== 'RESTORE') {
      toast({ variant: 'destructive', title: 'Error', description: 'Please type RESTORE to confirm' });
      return;
    }

    if (!backup.file_path) {
      toast({ variant: 'destructive', title: 'Error', description: 'Backup file not found' });
      return;
    }

    setIsRestoring(backup.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/restore-backup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ file_path: backup.file_path }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Restore failed');

      toast({
        title: 'Backup restored successfully!',
        description: result.message,
      });
      setRestoreConfirmText('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Restore Failed', description: message });
    } finally {
      setIsRestoring(null);
    }
  };

  const deleteBackup = async (backup: Backup) => {
    try {
      if (backup.file_path) {
        await supabase.storage.from('backups').remove([backup.file_path]);
      }
      await supabase.from('backups').delete().eq('id', backup.id);
      toast({ title: 'Backup deleted' });
      fetchBackups();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Create Backup */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Create Backup
          </CardTitle>
          <CardDescription>
            Export all your data including inventory, invoices, clients, orders, and settings.
            User accounts and roles are preserved and never lost during restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-notes">Backup Notes (optional)</Label>
            <Input
              id="backup-notes"
              placeholder="e.g., Before month-end cleanup..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button onClick={createBackup} disabled={isCreating} className="btn-gold">
            {isCreating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Backup...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Create Backup Now</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Backup History
          </CardTitle>
          <CardDescription>
            View all backups and restore to any point. Oldest to newest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No backups yet. Create your first backup above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-muted/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {backup.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : backup.status === 'failed' ? (
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm">
                        {format(new Date(backup.created_at), 'dd MMM yyyy, hh:mm a')}
                      </span>
                      <Badge variant={backup.backup_type === 'scheduled' ? 'secondary' : 'outline'} className="text-xs">
                        {backup.backup_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {backup.file_size > 0 && (
                        <span>{formatFileSize(backup.file_size)}</span>
                      )}
                      {backup.notes && (
                        <span className="truncate">{backup.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {backup.status === 'completed' && backup.file_path && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1">
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              Restore Backup?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                              <span className="block">
                                This will <strong>replace all current data</strong> with the backup from{' '}
                                <strong>{format(new Date(backup.created_at), 'dd MMM yyyy, hh:mm a')}</strong>.
                              </span>
                              <span className="block text-green-600 font-medium">
                                ✓ User accounts, roles, and login credentials are SAFE and will NOT be affected.
                              </span>
                              <span className="block text-destructive font-medium">
                                ⚠ All data created after this backup will be lost.
                              </span>
                              <span className="block mt-4">
                                Type <strong className="font-mono bg-muted px-1 py-0.5 rounded">RESTORE</strong> to confirm:
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Input
                            value={restoreConfirmText}
                            onChange={(e) => setRestoreConfirmText(e.target.value)}
                            placeholder="Type RESTORE"
                            className="font-mono"
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setRestoreConfirmText('')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => restoreBackup(backup)}
                              disabled={restoreConfirmText !== 'RESTORE' || isRestoring === backup.id}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isRestoring === backup.id ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restoring...</>
                              ) : (
                                'Restore Backup'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the backup file. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBackup(backup)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
