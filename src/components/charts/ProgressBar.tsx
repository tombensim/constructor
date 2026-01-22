'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const sizeClasses = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
};

const variantClasses = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

function getVariantFromValue(value: number): 'default' | 'success' | 'warning' | 'danger' {
  if (value >= 80) return 'success';
  if (value >= 50) return 'default';
  if (value >= 20) return 'warning';
  return 'danger';
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  size = 'md',
  variant,
  className,
}: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, value));
  const actualVariant = variant || getVariantFromValue(safeValue);

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-muted-foreground">
              {safeValue}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-secondary rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variantClasses[actualVariant]
          )}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

interface CategoryProgressBarProps {
  category: string;
  completed: number;
  total: number;
  color?: string;
}

export function CategoryProgressBar({
  category,
  completed,
  total,
  color,
}: CategoryProgressBarProps) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{category}</span>
        <span className="text-sm text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: color || 'hsl(var(--primary))',
          }}
        />
      </div>
    </div>
  );
}
