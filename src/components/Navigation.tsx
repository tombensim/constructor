'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  FileText,
  CalendarClock,
  Home,
} from 'lucide-react';

const navItems = [
  {
    href: '/',
    label: 'לוח בקרה',
    icon: LayoutDashboard,
  },
  {
    href: '/apartments',
    label: 'דירות',
    icon: Building2,
  },
  {
    href: '/timeline',
    label: 'ציר זמן',
    icon: CalendarClock,
  },
  {
    href: '/reports',
    label: 'דוחות',
    icon: FileText,
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-card border-l border-border p-4 flex flex-col">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Home className="h-6 w-6" />
          <span>מוסינזון 5</span>
        </Link>
        <p className="text-sm text-muted-foreground mt-1">
          תמ״א 38/2 - תל אביב
        </p>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          מערכת מעקב בנייה
        </p>
      </div>
    </nav>
  );
}
