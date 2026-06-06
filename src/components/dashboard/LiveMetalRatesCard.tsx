import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Edit, History, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Rates {
  silver_rate_per_gram: number;
  gold_rate_per_gram: number; // stored as 22K
  updated_at: string;
}

interface RateHistoryItem {
  id: string;
  silver_rate_per_gram: number;
  gold_rate_per_gram: number;
  created_at: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

interface RateCardProps {
  title: string;
  rate: number;
  updatedAt?: string;
  editable?: boolean;
  onEdit?: () => void;
  history: RateHistoryItem[];
  historyKey: 'silver' | 'gold_22k' | 'gold_18k' | 'gold_24k';
}

function RateCard({ title, rate, updatedAt, editable, onEdit, history, historyKey }: RateCardProps) {
  const [open, setOpen] = useState(false);

  const getHistoryValue = (item: RateHistoryItem) => {
    switch (historyKey) {
      case 'silver': return item.silver_rate_per_gram;
      case 'gold_22k': return item.gold_rate_per_gram;
      case 'gold_18k': return item.gold_rate_per_gram * (18 / 22);
      case 'gold_24k': return item.gold_rate_per_gram * (24 / 22);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
        {editable && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Rate Per Gram</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(rate)}/g</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          Last updated: {updatedAt ? format(new Date(updatedAt), 'dd MMM yyyy, hh:mm a') : '-'}
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Rate History
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No rate changes recorded</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs bg-muted/50 rounded p-2">
                    <Badge variant="outline">{formatCurrency(getHistoryValue(item))}</Badge>
                    <span className="text-muted-foreground">
                      {format(new Date(item.created_at), 'dd MMM, HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export function LiveMetalRatesCard() {
  const [rates, setRates] = useState<Rates | null>(null);
  const [history, setHistory] = useState<RateHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editSilver, setEditSilver] = useState('');
  const [editGold22, setEditGold22] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRate();
    fetchHistory();
  }, []);

  const fetchRate = async () => {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('silver_rate_per_gram, gold_rate_per_gram, updated_at')
        .limit(1)
        .single();
      if (error) throw error;
      setRates(data);
    } catch (error) {
      console.error('Error fetching rate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('rate_history')
        .select('id, silver_rate_per_gram, gold_rate_per_gram, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching rate history:', error);
    }
  };

  const handleEdit = () => {
    if (rates) {
      setEditSilver(rates.silver_rate_per_gram.toString());
      setEditGold22(rates.gold_rate_per_gram.toString());
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update({
          silver_rate_per_gram: parseFloat(editSilver),
          gold_rate_per_gram: parseFloat(editGold22),
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('Metal rates updated successfully');
      setIsEditing(false);
      fetchRate();
      fetchHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rates');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const gold22 = rates?.gold_rate_per_gram || 0;
  const gold18 = gold22 * (18 / 22);
  const gold24 = gold22 * (24 / 22);
  const silver = rates?.silver_rate_per_gram || 0;

  return (
    <>
      <RateCard
        title="Live Silver Rate"
        rate={silver}
        updatedAt={rates?.updated_at}
        editable
        onEdit={handleEdit}
        history={history}
        historyKey="silver"
      />
      <RateCard
        title="Live Gold 22K Rate"
        rate={gold22}
        updatedAt={rates?.updated_at}
        editable
        onEdit={handleEdit}
        history={history}
        historyKey="gold_22k"
      />
      <RateCard
        title="Live Gold 18K Rate"
        rate={gold18}
        updatedAt={rates?.updated_at}
        history={history}
        historyKey="gold_18k"
      />
      <RateCard
        title="Live Gold 24K Rate"
        rate={gold24}
        updatedAt={rates?.updated_at}
        history={history}
        historyKey="gold_24k"
      />

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Update Metal Rates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="silverRate">Silver Rate (per gram)</Label>
              <Input
                id="silverRate"
                type="number"
                value={editSilver}
                onChange={(e) => setEditSilver(e.target.value)}
                placeholder="Enter silver rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goldRate">Gold 22K Rate (per gram)</Label>
              <Input
                id="goldRate"
                type="number"
                value={editGold22}
                onChange={(e) => setEditGold22(e.target.value)}
                placeholder="Enter gold 22K rate"
              />
              <p className="text-xs text-muted-foreground">
                18K and 24K are auto-calculated from the 22K rate.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Rates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
