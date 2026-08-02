import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';
import { getUiScale, setUiScale, UI_SCALE_OPTIONS, DEFAULT_UI_SCALE } from '@/lib/uiScale';

export function DisplaySettings() {
  const [scale, setScale] = useState<number>(getUiScale());

  const apply = (value: number) => {
    setScale(value);
    setUiScale(value);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" />
          Display Scale
        </CardTitle>
        <CardDescription>
          Fits more data on screen without browser zoom. The app ships at {DEFAULT_UI_SCALE}% so wide tables and dashboards stay readable on laptops.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {UI_SCALE_OPTIONS.map((option) => (
            <Button
              key={option}
              variant={scale === option ? 'default' : 'outline'}
              onClick={() => apply(option)}
            >
              {option}%{option === DEFAULT_UI_SCALE ? ' (default)' : ''}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Current scale: <span className="font-medium text-foreground">{scale}%</span>. This preference is stored on this device.
        </p>
      </CardContent>
    </Card>
  );
}
