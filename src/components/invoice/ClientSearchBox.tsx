import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserPlus } from 'lucide-react';

interface ClientLite {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  clients: ClientLite[];
  onSelect: (client: ClientLite) => void;
  onWalkIn: () => void;
}

export function ClientSearchBox({ clients, onSelect, onWalkIn }: Props) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = term.trim().toLowerCase();
  const results = q
    ? clients.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q),
      ).slice(0, 50)
    : [];

  const handlePick = (c: ClientLite) => {
    onSelect(c);
    setTerm(`${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
    setOpen(false);
  };

  const handleWalkIn = () => {
    onWalkIn();
    setTerm('');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => term && setOpen(true)}
          placeholder="Search client by name or phone..."
          className="pl-10"
        />
      </div>

      {open && q.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handlePick(c)}
                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <div className="font-medium text-sm">{c.name}</div>
                {c.phone && (
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                )}
              </button>
            ))
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-sm text-muted-foreground">
                No clients found matching "{term}"
              </div>
              <button
                type="button"
                onClick={handleWalkIn}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed hover:bg-accent transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                New / Walk-in Customer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
