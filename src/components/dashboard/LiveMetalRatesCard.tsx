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

interface MetalRates {
  gold_rate_per_gram: number;
  silver_rate_per_gram: number;
  updated_at: string;
}

interface RateHistoryItem {
  id: string;
  gold_rate_per_gram: number;
  silver_rate_per_gram: number;
  created_at: string;
}

export function LiveMetalRatesCard() {
  const [rates, setRates] = useState<MetalRates | null>(null);
  const [history, setHistory] = useState<RateHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editGoldRate, setEditGoldRate] = useState('');
  const [editSilverRate, setEditSilverRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRates();
    fetchHistory();
  }, []);

  const fetchRates = async () => {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('gold_rate_per_gram, silver_rate_per_gram, updated_at')
        .limit(1)
        .single();

      if (error) throw error;
      setRates(data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('rate_history')
        .select('*')
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
      setEditGoldRate(rates.gold_rate_per_gram.toString());
      setEditSilverRate(rates.silver_rate_per_gram.toString());
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update({
          gold_rate_per_gram: parseFloat(editGoldRate),
          silver_rate_per_gram: parseFloat(editSilverRate),
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

      if (error) throw error;

      toast.success('Metal rates updated successfully');
      setIsEditing(false);
      fetchRates();
      fetchHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rates');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-gold">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-l-4 border-l-gold">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold" />
            Live Metal Rates
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Edit className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Gold Rate</p>
              <p className="text-xl font-bold text-gold">
                {formatCurrency(rates?.gold_rate_per_gram || 0)}/g
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Silver Rate</p>
              <p className="text-xl font-bold text-muted-foreground">
                {formatCurrency(rates?.silver_rate_per_gram || 0)}/g
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last updated: {rates?.updated_at ? format(new Date(rates.updated_at), 'dd MMM yyyy, hh:mm a') : '-'}
          </div>

          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Rate History
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No rate changes recorded</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs bg-muted/50 rounded p-2">
                      <div className="flex gap-3">
                        <Badge variant="outline" className="text-gold border-gold/20 bg-gold/5">
                          Gold: {formatCurrency(item.gold_rate_per_gram)}
                        </Badge>
                        <Badge variant="outline">
                          Silver: {formatCurrency(item.silver_rate_per_gram)}
                        </Badge>
                      </div>
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

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-gold" />
              Update Metal Rates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goldRate">Gold Rate (per gram)</Label>
              <Input
                id="goldRate"
                type="number"
                value={editGoldRate}
                onChange={(e) => setEditGoldRate(e.target.value)}
                placeholder="Enter gold rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="silverRate">Silver Rate (per gram)</Label>
              <Input
                id="silverRate"
                type="number"
                value={editSilverRate}
                onChange={(e) => setEditSilverRate(e.target.value)}
                placeholder="Enter silver rate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="btn-gold">
              {isSaving ? 'Saving...' : 'Save Rates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
