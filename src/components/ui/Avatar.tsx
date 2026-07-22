import React from 'react';
import { cn, getInitials } from '@/lib/utils';

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className,
}) => {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const initials = getInitials(name);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-slate-100 text-slate-700 font-semibold border border-slate-200/80 shrink-0 select-none shadow-soft-xs',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image link and reveal initials background
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : null}
      <span className={cn('uppercase', src ? 'hidden' : 'block')}>
        {initials}
      </span>
    </div>
  );
};
