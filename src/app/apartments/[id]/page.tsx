'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DefectHistoryChart } from '@/components/charts/DefectHistoryChart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Camera,
  ChevronDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  categoryHebrewNames,
  categoryColors,
  statusHebrewNames,
  statusColors,
  WorkCategory,
  WorkStatus,
  isPositiveStatus,
  isNegativeStatus,
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

// Sort category entries by fixed display order (OTHER always last)
function sortCategoryEntries<T>(entries: [string, T][]): [string, T][] {
  return entries.sort((a, b) => {
    const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a[0] as WorkCategory);
    const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b[0] as WorkCategory);
    // If not found in order, put before OTHER
    const orderA = indexA === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexA;
    const orderB = indexB === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexB;
    return orderA - orderB;
  });
}

interface WorkItem {
  id: string;
  category: string;
  categoryHebrew?: string;
  location: string | null;
  description: string;
  status: string;
  notes: string | null;
  hasPhoto: boolean;
  progress?: number;
  reportDate?: string;
}

interface StatusCounts {
  itemCount: number;
  completed: number;
  defects: number;
  inProgress: number;
  completedItems: WorkItem[];
  defectItems: WorkItem[];
  inProgressItems: WorkItem[];
}

interface ApartmentDetail {
  apartment: {
    id: string;
    number: string;
    floor: number | null;
  };
  cumulative: StatusCounts & {
    progress: number;
  };
  latestReport: (StatusCounts & {
    date: string;
  }) | null;
  detailedProgress?: {
    category: string;
    categoryHebrew: string;
    progress: number;
    itemCount: number;
    hasIssues: boolean;
    issues: string[];
  }[];
  categoryGroups: Record<string, WorkItem[]>;
  progressHistory: {
    date: string;
    progress: number;
    categoryProgress?: Record<string, number>;
    issues: number;
    itemCount: number;
  }[];
  defectHistoryByCategory?: {
    date: string;
    categoryDefects: Record<string, number>;
  }[];
  allReports: {
    reportId: string;
    reportDate: string;
    overallProgress: number;
    categoryProgress: Record<string, number>;
    totalIssues: number;
    itemCount: number;
    items: WorkItem[];
  }[];
}

interface ApartmentListItem {
  id: string;
  number: string;
}

export default function ApartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const aptId = params.id as string;
  const [data, setData] = useState<ApartmentDetail | null>(null);
  const [allApartments, setAllApartments] = useState<ApartmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states - cumulative (all reports)
  const [cumCompletedDialogOpen, setCumCompletedDialogOpen] = useState(false);
  const [cumDefectsDialogOpen, setCumDefectsDialogOpen] = useState(false);
  const [cumInProgressDialogOpen, setCumInProgressDialogOpen] = useState(false);

  // Dialog states - latest report
  const [latestCompletedDialogOpen, setLatestCompletedDialogOpen] = useState(false);
  const [latestDefectsDialogOpen, setLatestDefectsDialogOpen] = useState(false);
  const [latestInProgressDialogOpen, setLatestInProgressDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch both apartment details and list of all apartments in parallel
        const [aptRes, listRes] = await Promise.all([
          fetch(`/api/apartments/${aptId}`),
          fetch('/api/apartments'),
        ]);

        if (!aptRes.ok) {
          if (aptRes.status === 404) {
            throw new Error('דירה לא נמצאה');
          }
          throw new Error('Failed to fetch apartment');
        }

        const [aptResult, listResult] = await Promise.all([
          aptRes.json(),
          listRes.json(),
        ]);

        setData(aptResult);
        setAllApartments(listResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    if (aptId) {
      fetchData();
    }
  }, [aptId]);

  if (loading) {
    return <ApartmentDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/apartments">
          <Button variant="ghost" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            חזרה לרשימת הדירות
          </Button>
        </Link>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">שגיאה: {error || 'לא נמצאו נתונים'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { apartment, cumulative, latestReport, categoryGroups } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/apartments">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <h1 className="text-3xl font-bold flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                <Building2 className="h-8 w-8" />
                דירה {apartment.number}
                <ChevronDown className="h-5 w-5" />
              </h1>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {allApartments.map((apt) => (
                <DropdownMenuItem
                  key={apt.id}
                  onClick={() => router.push(`/apartments/${apt.number}`)}
                  className={apt.number === apartment.number ? 'bg-accent' : ''}
                >
                  דירה {apt.number}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {apartment.floor && (
            <p className="text-muted-foreground">קומה {apartment.floor}</p>
          )}
        </div>
      </div>

      {cumulative && (
        <>
          {/* Row 1: Cumulative Stats (All Reports) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                📊 סה״כ מצטבר (כל הדוחות)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Progress Card */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-4 pb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{cumulative.progress}%</div>
                      <Progress value={cumulative.progress} className="mt-2 h-2" />
                      <p className="text-xs text-muted-foreground mt-1">התקדמות כללית</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Completed Card */}
                <Card
                  className="cursor-pointer hover:bg-green-100 transition-colors bg-green-50"
                  onClick={() => setCumCompletedDialogOpen(true)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                      <div>
                        <div className="text-2xl font-bold text-green-600">{cumulative.completed}</div>
                        <p className="text-xs text-muted-foreground">הושלמו</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Defects Card */}
                <Card
                  className="cursor-pointer hover:bg-orange-100 transition-colors bg-orange-50"
                  onClick={() => setCumDefectsDialogOpen(true)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold text-orange-600">{cumulative.defects}</div>
                        <p className="text-xs text-muted-foreground">ליקויים</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* In Progress Card */}
                <Card
                  className="cursor-pointer hover:bg-blue-100 transition-colors bg-blue-50"
                  onClick={() => setCumInProgressDialogOpen(true)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-6 w-6 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{cumulative.inProgress}</div>
                        <p className="text-xs text-muted-foreground">בטיפול</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Row 2: Latest Report Stats */}
          {latestReport && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  📋 מצב עדכני (דוח אחרון - {formatDate(latestReport.date)})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Empty placeholder to align with progress card above */}
                  <div className="hidden md:block" />

                  {/* Completed Card */}
                  <Card
                    className="cursor-pointer hover:bg-green-100 transition-colors bg-green-50"
                    onClick={() => setLatestCompletedDialogOpen(true)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <div>
                          <div className="text-2xl font-bold text-green-600">{latestReport.completed}</div>
                          <p className="text-xs text-muted-foreground">הושלמו</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Defects Card */}
                  <Card
                    className="cursor-pointer hover:bg-orange-100 transition-colors bg-orange-50"
                    onClick={() => setLatestDefectsDialogOpen(true)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                        <div>
                          <div className="text-2xl font-bold text-orange-600">{latestReport.defects}</div>
                          <p className="text-xs text-muted-foreground">ליקויים</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* In Progress Card */}
                  <Card
                    className="cursor-pointer hover:bg-blue-100 transition-colors bg-blue-50"
                    onClick={() => setLatestInProgressDialogOpen(true)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-6 w-6 text-blue-500" />
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{latestReport.inProgress}</div>
                          <p className="text-xs text-muted-foreground">בטיפול</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

          {/* === CUMULATIVE DIALOGS === */}
          {/* Cumulative Completed Dialog */}
          <Dialog open={cumCompletedDialogOpen} onOpenChange={setCumCompletedDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  {cumulative.completed} פריטים שהושלמו (כל הדוחות)
                </DialogTitle>
                <DialogClose onClick={() => setCumCompletedDialogOpen(false)} />
              </DialogHeader>
              <div className="space-y-2 p-4">
                {cumulative.completedItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">אין פריטים שהושלמו</p>
                ) : (
                  cumulative.completedItems.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-green-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <Badge variant="outline" className="mr-2">
                              {categoryHebrewNames[item.category as WorkCategory] || item.category}
                            </Badge>
                            {item.location && <span className="mr-2">📍 {item.location}</span>}
                            {item.reportDate && (
                              <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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

          {/* Cumulative Defects Dialog */}
          <Dialog open={cumDefectsDialogOpen} onOpenChange={setCumDefectsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                  {cumulative.defects} ליקויים (כל הדוחות)
                </DialogTitle>
                <DialogClose onClick={() => setCumDefectsDialogOpen(false)} />
              </DialogHeader>
              <div className="space-y-2 p-4">
                {cumulative.defectItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">אין ליקויים</p>
                ) : (
                  cumulative.defectItems.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-orange-50/50 border-orange-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <Badge variant="outline" className="mr-2">
                              {categoryHebrewNames[item.category as WorkCategory] || item.category}
                            </Badge>
                            {item.location && <span className="mr-2">📍 {item.location}</span>}
                            {item.reportDate && (
                              <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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

          {/* Cumulative In Progress Dialog */}
          <Dialog open={cumInProgressDialogOpen} onOpenChange={setCumInProgressDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-600">
                  <Clock className="h-5 w-5" />
                  {cumulative.inProgress} פריטים בטיפול (כל הדוחות)
                </DialogTitle>
                <DialogClose onClick={() => setCumInProgressDialogOpen(false)} />
              </DialogHeader>
              <div className="space-y-2 p-4">
                {cumulative.inProgressItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">אין פריטים בטיפול</p>
                ) : (
                  cumulative.inProgressItems.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-blue-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <Badge variant="outline" className="mr-2">
                              {categoryHebrewNames[item.category as WorkCategory] || item.category}
                            </Badge>
                            {item.location && <span className="mr-2">📍 {item.location}</span>}
                            {item.reportDate && (
                              <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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

          {/* === LATEST REPORT DIALOGS === */}
          {latestReport && (
            <>
              {/* Latest Completed Dialog */}
              <Dialog open={latestCompletedDialogOpen} onOpenChange={setLatestCompletedDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      {latestReport.completed} פריטים שהושלמו (דוח אחרון)
                    </DialogTitle>
                    <DialogClose onClick={() => setLatestCompletedDialogOpen(false)} />
                  </DialogHeader>
                  <div className="space-y-2 p-4">
                    {latestReport.completedItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">אין פריטים שהושלמו בדוח האחרון</p>
                    ) : (
                      latestReport.completedItems.map((item) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-green-50/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="mr-2">
                                  {categoryHebrewNames[item.category as WorkCategory] || item.category}
                                </Badge>
                                {item.location && <span className="mr-2">📍 {item.location}</span>}
                                {item.reportDate && (
                                  <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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

              {/* Latest Defects Dialog */}
              <Dialog open={latestDefectsDialogOpen} onOpenChange={setLatestDefectsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      {latestReport.defects} ליקויים (דוח אחרון)
                    </DialogTitle>
                    <DialogClose onClick={() => setLatestDefectsDialogOpen(false)} />
                  </DialogHeader>
                  <div className="space-y-2 p-4">
                    {latestReport.defectItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">אין ליקויים בדוח האחרון</p>
                    ) : (
                      latestReport.defectItems.map((item) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-orange-50/50 border-orange-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="mr-2">
                                  {categoryHebrewNames[item.category as WorkCategory] || item.category}
                                </Badge>
                                {item.location && <span className="mr-2">📍 {item.location}</span>}
                                {item.reportDate && (
                                  <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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

              {/* Latest In Progress Dialog */}
              <Dialog open={latestInProgressDialogOpen} onOpenChange={setLatestInProgressDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-blue-600">
                      <Clock className="h-5 w-5" />
                      {latestReport.inProgress} פריטים בטיפול (דוח אחרון)
                    </DialogTitle>
                    <DialogClose onClick={() => setLatestInProgressDialogOpen(false)} />
                  </DialogHeader>
                  <div className="space-y-2 p-4">
                    {latestReport.inProgressItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">אין פריטים בטיפול בדוח האחרון</p>
                    ) : (
                      latestReport.inProgressItems.map((item) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-blue-50/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="mr-2">
                                  {categoryHebrewNames[item.category as WorkCategory] || item.category}
                                </Badge>
                                {item.location && <span className="mr-2">📍 {item.location}</span>}
                                {item.reportDate && (
                                  <span className="mr-2">📅 {formatDate(item.reportDate)}</span>
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
            </>
          )}

          {/* Defect History Chart */}
          {data.defectHistoryByCategory && data.defectHistoryByCategory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>היסטוריית טיפול בליקויים</CardTitle>
              </CardHeader>
              <CardContent>
                <DefectHistoryChart
                  data={data.defectHistoryByCategory.map((point) => ({
                    date: point.date,
                    categoryDefects: point.categoryDefects,
                  }))}
                  categories={Array.from(
                    new Set(
                      data.defectHistoryByCategory.flatMap((point) =>
                        Object.keys(point.categoryDefects)
                      )
                    )
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Work Items by Category */}
          <Card>
            <CardHeader>
              <CardTitle>פריטי עבודה לפי קטגוריה</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={sortCategoryEntries(Object.entries(categoryGroups))[0]?.[0] || 'none'}>
                <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent">
                  {sortCategoryEntries(Object.entries(categoryGroups)).map(([category, items]) => {
                    const completed = items.filter((i) =>
                      isPositiveStatus(i.status as WorkStatus)
                    ).length;
                    const defects = items.filter((i) =>
                      isNegativeStatus(i.status as WorkStatus)
                    ).length;

                    return (
                      <TabsTrigger
                        key={category}
                        value={category}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        <span
                          className="w-2 h-2 rounded-full ml-2"
                          style={{
                            backgroundColor:
                              categoryColors[category as WorkCategory] || '#6b7280',
                          }}
                        />
                        {categoryHebrewNames[category as WorkCategory] || category}
                        <Badge variant="secondary" className="mr-2">
                          {completed}/{items.length}
                        </Badge>
                        {defects > 0 && (
                          <Badge variant="destructive">{defects}</Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {sortCategoryEntries(Object.entries(categoryGroups)).map(([category, items]) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>תיאור</TableHead>
                          <TableHead>מיקום</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>תאריך</TableHead>
                          <TableHead>הערות</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.description}
                            </TableCell>
                            <TableCell>{item.location || '-'}</TableCell>
                            <TableCell>
                              <Badge
                                style={{
                                  backgroundColor:
                                    statusColors[item.status as WorkStatus] ||
                                    '#6b7280',
                                  color: 'white',
                                }}
                              >
                                {statusHebrewNames[item.status as WorkStatus] ||
                                  item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {item.reportDate ? formatDate(item.reportDate) : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {item.notes || '-'}
                            </TableCell>
                            <TableCell>
                              {item.hasPhoto && (
                                <Camera className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {!latestReport && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              אין נתונים זמינים לדירה זו
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApartmentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
