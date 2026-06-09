import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface BlankZeroInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  /** Current numeric value. 0 (or NaN) is rendered as an empty field. */
  value: number | string | null | undefined;
  /** Called with the parsed numeric value (0 when blank). */
  onValueChange?: (val: number) => void;
  /** Optional raw onChange if you need the event. */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Parse as int instead of float. */
  integer?: boolean;
  /** Force the input type — defaults to "number". */
  inputType?: string;
}

/**
 * Numeric input that displays a blank field when the underlying value is 0.
 * Keeps storage semantics intact (callers still receive a number, defaulting to 0).
 */
export const BlankZeroInput = React.forwardRef<HTMLInputElement, BlankZeroInputProps>(
  ({ value, onValueChange, onChange, integer, inputType = 'number', className, step, min, ...rest }, ref) => {
    const numeric = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    const display = !numeric || Number.isNaN(numeric) ? '' : String(numeric);
    return (
      <Input
        ref={ref}
        type={inputType}
        step={step ?? (integer ? 1 : '0.01')}
        min={min ?? 0}
        value={display}
        onChange={(e) => {
          onChange?.(e);
          const raw = e.target.value;
          if (raw === '') {
            onValueChange?.(0);
            return;
          }
          const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
          onValueChange?.(Number.isFinite(parsed) ? parsed : 0);
        }}
        className={cn(className)}
        {...rest}
      />
    );
  },
);
BlankZeroInput.displayName = 'BlankZeroInput';
