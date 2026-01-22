'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Camera,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  categoryHebrewNames,
  categoryColors,
  statusHebrewNames,
  statusColors,
  WorkCategory,
  WorkStatus,
  isPositiveStatus,
  isNegativeStatus,
} from '@/lib/status-mapper';

interface WorkItem {
  id: string;
  category: string;
  location: string | null;
  description: string;
  status: string;
  notes: string | null;
  hasPhoto: boolean;
}

interface ApartmentDetail {
  apartment: {
    id: string;
    number: string;
    floor: number | null;
  };
  latestReport: {
    date: string;
    total: number;
    completed: number;
    defects: number;
    progress: number;
  } | null;
  categoryGroups: Record<string, WorkItem[]>;
  progressHistory: {
    date: string;
    progress: number;
    completed: number;
    total: number;
  }[];
  allReports: {
    reportId: string;
    reportDate: string;
    total: number;
    completed: number;
    defects: number;
    progress: number;
    items: WorkItem[];
  }[];
}

export default function ApartmentDetailPage() {
  const params = useParams();
  const aptId = params.id as string;
  const [data, setData] = useState<ApartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApartment() {
      try {
        const res = await fetch(`/api/apartments/${aptId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('דירה לא נמצאה');
          }
          throw new Error('Failed to fetch apartment');
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    if (aptId) {
      fetchApartment();
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

  const { apartment, latestReport, categoryGroups, progressHistory } = data;

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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            דירה {apartment.number}
          </h1>
          {apartment.floor && (
            <p className="text-muted-foreground">קומה {apartment.floor}</p>
          )}
        </div>
      </div>

      {latestReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold">{latestReport.progress}%</div>
                  <Progress value={latestReport.progress} className="mt-2 h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    התקדמות כללית
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {latestReport.completed}
                    </div>
                    <p className="text-sm text-muted-foreground">הושלמו</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                  <div>
                    <div className="text-3xl font-bold text-orange-600">
                      {latestReport.defects}
                    </div>
                    <p className="text-sm text-muted-foreground">ליקויים</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="text-3xl font-bold">
                      {latestReport.total - latestReport.completed}
                    </div>
                    <p className="text-sm text-muted-foreground">בטיפול</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Chart */}
          {progressHistory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>התקדמות לאורך זמן</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString('he-IL', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        labelFormatter={(value) =>
                          new Date(value as string).toLocaleDateString('he-IL')
                        }
                        formatter={(value) => [`${value}%`, 'התקדמות']}
                      />
                      <Line
                        type="monotone"
                        dataKey="progress"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Items by Category */}
          <Card>
            <CardHeader>
              <CardTitle>פריטי עבודה לפי קטגוריה</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={Object.keys(categoryGroups)[0] || 'none'}>
                <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent">
                  {Object.entries(categoryGroups).map(([category, items]) => {
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

                {Object.entries(categoryGroups).map(([category, items]) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>תיאור</TableHead>
                          <TableHead>מיקום</TableHead>
                          <TableHead>סטטוס</TableHead>
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
