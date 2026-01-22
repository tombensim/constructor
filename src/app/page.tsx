'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryProgressBar } from '@/components/charts/ProgressBar';
import {
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import {
  categoryHebrewNames,
  categoryColors,
  WorkCategory,
  statusHebrewNames,
  WorkStatus,
} from '@/lib/status-mapper';

interface StatsData {
  totalReports: number;
  totalApartments: number;
  overallProgress: number;
  completedItems: number;
  defectItems: number;
  inProgressItems: number;
  totalItems: number;
  categoryStats: {
    category: string;
    total: number;
    completed: number;
    progress: number;
  }[];
  apartmentStats: {
    number: string;
    total: number;
    completed: number;
    defects: number;
    progress: number;
  }[];
  recentDefects: {
    id: string;
    apartment: string;
    category: string;
    description: string;
    status: string;
  }[];
  latestReportDate?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">שגיאה: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats || stats.totalReports === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">לוח בקרה</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              אין נתונים זמינים. יש לעבד את קבצי ה-PDF תחילה.
            </p>
            <p className="text-sm mt-2">
              הרץ: <code className="bg-muted px-2 py-1 rounded">npx ts-node scripts/process-pdfs.ts</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">לוח בקרה</h1>
        {stats.latestReportDate && (
          <Badge variant="outline" className="text-sm">
            עדכון אחרון: {new Date(stats.latestReportDate).toLocaleDateString('he-IL')}
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">התקדמות כללית</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.overallProgress}%</div>
            <Progress value={stats.overallProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.completedItems} מתוך {stats.totalItems} פריטים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">דירות</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalApartments}</div>
            <p className="text-xs text-muted-foreground mt-2">
              דירות במעקב
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הושלמו</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.completedItems}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              פריטי עבודה הושלמו
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ליקויים</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.defectItems}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              פריטים עם ליקויים
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apartment Progress Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              התקדמות לפי דירה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.apartmentStats.map((apt) => (
                <Link
                  key={apt.number}
                  href={`/apartments/${apt.number}`}
                  className="block"
                >
                  <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="text-center">
                        <div className="text-lg font-bold">
                          {apt.number === 'פיתוח' ? 'פיתוח' : `דירה ${apt.number}`}
                        </div>
                        <div className="text-2xl font-bold mt-1">
                          {apt.progress}%
                        </div>
                        <Progress value={apt.progress} className="mt-2 h-2" />
                        {apt.defects > 0 && (
                          <Badge variant="destructive" className="mt-2 text-xs">
                            {apt.defects} ליקויים
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              התקדמות לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.categoryStats.slice(0, 8).map((cat) => (
                <CategoryProgressBar
                  key={cat.category}
                  category={categoryHebrewNames[cat.category as WorkCategory] || cat.category}
                  completed={cat.completed}
                  total={cat.total}
                  color={categoryColors[cat.category as WorkCategory]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Defects */}
      {stats.recentDefects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              ליקויים אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentDefects.map((defect) => (
                <div
                  key={defect.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100"
                >
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {defect.apartment === 'פיתוח'
                          ? 'פיתוח'
                          : `דירה ${defect.apartment}`}
                      </Badge>
                      <Badge variant="secondary">
                        {categoryHebrewNames[defect.category as WorkCategory] ||
                          defect.category}
                      </Badge>
                      <Badge
                        variant={
                          defect.status === WorkStatus.DEFECT
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {statusHebrewNames[defect.status as WorkStatus] ||
                          defect.status}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground truncate">
                      {defect.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.totalReports}</div>
                <div className="text-sm text-muted-foreground">דוחות</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.completedItems}</div>
                <div className="text-sm text-muted-foreground">הושלמו</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.inProgressItems}</div>
                <div className="text-sm text-muted-foreground">בטיפול</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.defectItems}</div>
                <div className="text-sm text-muted-foreground">ליקויים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-2 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
