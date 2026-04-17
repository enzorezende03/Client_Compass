import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ReactNode } from 'react';

export interface OptionItem {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  /** Tailwind classes applied when selected (background/text/border tint). */
  activeClass?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  /** When true, clicking the active option clears it (sends ''). */
  clearable?: boolean;
  columns?: 2 | 3 | 4 | 5;
  size?: 'sm' | 'md';
}

const COL_MAP: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
};

export function OptionButtons({ value, onChange, options, clearable, columns = 3, size = 'md' }: Props) {
  return (
    <div className={cn('grid gap-2', COL_MAP[columns])}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active && clearable ? '' : opt.value)}
            className={cn(
              'group relative flex flex-col items-start gap-1 rounded-lg border-2 text-left transition-all',
              size === 'md' ? 'p-3' : 'p-2',
              active
                ? cn('border-transparent shadow-sm ring-2 ring-offset-1 ring-offset-background', opt.activeClass ?? 'bg-primary/10 text-primary ring-primary/40')
                : 'border-border bg-card text-foreground hover:bg-muted/40 hover:border-muted-foreground/30',
            )}
          >
            <div className="flex items-center gap-2 w-full">
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              <span className={cn('font-semibold flex-1', size === 'md' ? 'text-sm' : 'text-xs')}>{opt.label}</span>
              {active && <Check className="h-4 w-4 shrink-0" />}
            </div>
            {opt.description && (
              <span className={cn('text-muted-foreground leading-snug', size === 'md' ? 'text-xs' : 'text-[10px]')}>
                {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
