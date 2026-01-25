'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryProgressBar } from '@/components/charts/ProgressBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
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
  statusColors,
  WorkStatus,
  CATEGORY_DISPLAY_ORDER,
} from '@/lib/status-mapper';

// Format date as DD/MM/YY
function formatDate(date: string | Date): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

// Sort category stats by fixed display order (OTHER always last)
function sortCategoryStats(stats: CategoryStat[]): CategoryStat[] {
  return [...stats].sort((a, b) => {
    const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a.category as WorkCategory);
    const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b.category as WorkCategory);
    const orderA = indexA === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexA;
    const orderB = indexB === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexB;
    return orderA - orderB;
  });
}

interface CategoryStat {
  category: string;
  categoryHebrew: string;
  progress: number;
  itemCount: number;
  issues: number;
}

interface ApartmentStat {
  number: string;
  progress: number;
  issues: number;
  itemCount: number;
  categoryProgress: Record<string, number>;
}

interface ItemWithDetails {
  id: string;
  apartment: string;
  category: string;
  categoryHebrew: string;
  description: string;
  status: string;
  notes: string | null;
  location: string | null;
  progress: number;
  reportDate?: string;
}

interface StatsData {
  totalReports: number;
  totalApartments: number;
  overallProgress: number;
  totalIssues: number;
  totalItems: number;
  totalCompleted: number;
  totalInProgress: number;
  categoryStats: CategoryStat[];
  apartmentStats: ApartmentStat[];
  recentIssues: ItemWithDetails[];
  allCompletedItems: ItemWithDetails[];
  allDefectItems: ItemWithDetails[];
  allInProgressItems: ItemWithDetails[];
  latestReportDate?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [completedDialogOpen, setCompletedDialogOpen] = useState(false);
  const [defectsDialogOpen, setDefectsDialogOpen] = useState(false);
  const [inProgressDialogOpen, setInProgressDialogOpen] = useState(false);

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

  // Calculate completed categories (progress === 100)
  const completedCategories = stats.categoryStats.filter(c => c.progress === 100).length;
  const inProgressCategories = stats.categoryStats.filter(c => c.progress > 0 && c.progress < 100).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">לוח בקרה</h1>
        {stats.latestReportDate && (
          <Badge variant="outline" className="text-sm">
            עדכון אחרון: {formatDate(stats.latestReportDate)}
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
              {stats.totalItems} פריטים
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setCompletedDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הושלמו</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.totalCompleted || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              פריטים שהושלמו
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setDefectsDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ליקויים</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.totalIssues}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              פריטים עם ליקויים
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setInProgressDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">בטיפול</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.totalInProgress || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              פריטים בטיפול
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Completed Items Dialog */}
      <Dialog open={completedDialogOpen} onOpenChange={setCompletedDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              {stats.totalCompleted || 0} פריטים שהושלמו
            </DialogTitle>
            <DialogClose onClick={() => setCompletedDialogOpen(false)} />
          </DialogHeader>
          <div className="space-y-2 p-4">
            {(!stats.allCompletedItems || stats.allCompletedItems.length === 0) ? (
              <p className="text-muted-foreground text-center py-4">אין פריטים שהושלמו</p>
            ) : (
              stats.allCompletedItems.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-green-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {item.apartment === 'פיתוח' ? 'פיתוח' : `דירה ${item.apartment}`}
                        </Badge>
                        <Badge variant="secondary">
                          {item.categoryHebrew}
                        </Badge>
                        {item.location && <span>📍 {item.location}</span>}
                        {item.reportDate && (
                          <span>📅 {formatDate(item.reportDate)}</span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-sm text-muted-foreground mt-1">{item.notes}</div>
                      )}
                    </div>
                    <Badge className="bg-green-500 text-white shrink-0">
                      {statusHebrewNames[item.status as WorkStatus] || item.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Defects Dialog */}
      <Dialog open={defectsDialogOpen} onOpenChange={setDefectsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {stats.totalIssues} ליקויים
            </DialogTitle>
            <DialogClose onClick={() => setDefectsDialogOpen(false)} />
          </DialogHeader>
          <div className="space-y-2 p-4">
            {(!stats.allDefectItems || stats.allDefectItems.length === 0) ? (
              <p className="text-muted-foreground text-center py-4">אין ליקויים</p>
            ) : (
              stats.allDefectItems.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-orange-50/50 border-orange-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {item.apartment === 'פיתוח' ? 'פיתוח' : `דירה ${item.apartment}`}
                        </Badge>
                        <Badge variant="secondary">
                          {item.categoryHebrew}
                        </Badge>
                        {item.location && <span>📍 {item.location}</span>}
                        {item.reportDate && (
                          <span>📅 {formatDate(item.reportDate)}</span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-sm text-orange-700 mt-2 p-2 bg-orange-100 rounded">
                          💬 {item.notes}
                        </div>
                      )}
                    </div>
                    <Badge 
                      style={{
                        backgroundColor: statusColors[item.status as WorkStatus] || '#f97316',
                        color: 'white',
                      }}
                      className="shrink-0"
                    >
                      {statusHebrewNames[item.status as WorkStatus] || item.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* In Progress Dialog */}
      <Dialog open={inProgressDialogOpen} onOpenChange={setInProgressDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Clock className="h-5 w-5" />
              {stats.totalInProgress || 0} פריטים בטיפול
            </DialogTitle>
            <DialogClose onClick={() => setInProgressDialogOpen(false)} />
          </DialogHeader>
          <div className="space-y-2 p-4">
            {(!stats.allInProgressItems || stats.allInProgressItems.length === 0) ? (
              <p className="text-muted-foreground text-center py-4">אין פריטים בטיפול</p>
            ) : (
              stats.allInProgressItems.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-blue-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {item.apartment === 'פיתוח' ? 'פיתוח' : `דירה ${item.apartment}`}
                        </Badge>
                        <Badge variant="secondary">
                          {item.categoryHebrew}
                        </Badge>
                        {item.location && <span>📍 {item.location}</span>}
                        {item.reportDate && (
                          <span>📅 {formatDate(item.reportDate)}</span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-sm text-muted-foreground mt-1">{item.notes}</div>
                      )}
                    </div>
                    <Badge 
                      style={{
                        backgroundColor: statusColors[item.status as WorkStatus] || '#3b82f6',
                        color: 'white',
                      }}
                      className="shrink-0"
                    >
                      {statusHebrewNames[item.status as WorkStatus] || item.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                        {apt.issues > 0 && (
                          <Badge variant="destructive" className="mt-2 text-xs">
                            {apt.issues} ליקויים
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
              {sortCategoryStats(stats.categoryStats).slice(0, 8).map((cat) => (
                <CategoryProgressBar
                  key={cat.category}
                  category={cat.categoryHebrew || categoryHebrewNames[cat.category as WorkCategory] || cat.category}
                  progress={cat.progress}
                  itemCount={cat.itemCount}
                  issues={cat.issues}
                  color={categoryColors[cat.category as WorkCategory]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Issues */}
      {stats.recentIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              ליקויים אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100"
                >
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {issue.apartment === 'פיתוח'
                          ? 'פיתוח'
                          : `דירה ${issue.apartment}`}
                      </Badge>
                      <Badge variant="secondary">
                        {issue.categoryHebrew || categoryHebrewNames[issue.category as WorkCategory] || issue.category}
                      </Badge>
                      <Badge variant="outline">
                        {issue.progress}%
                      </Badge>
                      {issue.reportDate && (
                        <span className="text-xs text-muted-foreground">
                          📅 {formatDate(issue.reportDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground truncate">
                      {issue.description}
                    </p>
                    {issue.notes && (
                      <p className="text-xs mt-1 text-orange-600">
                        {issue.notes}
                      </p>
                    )}
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
                <div className="text-2xl font-bold">{completedCategories}</div>
                <div className="text-sm text-muted-foreground">קטגוריות הושלמו</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{inProgressCategories}</div>
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
                <div className="text-2xl font-bold">{stats.totalIssues}</div>
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
