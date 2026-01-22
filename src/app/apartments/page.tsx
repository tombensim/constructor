'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryProgressBar } from '@/components/charts/ProgressBar';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import {
  categoryHebrewNames,
  categoryColors,
  WorkCategory,
} from '@/lib/status-mapper';

interface ApartmentData {
  id: string;
  number: string;
  floor: number | null;
  total: number;
  completed: number;
  defects: number;
  inProgress: number;
  progress: number;
  categoryStats: {
    category: string;
    total: number;
    completed: number;
    progress: number;
  }[];
}

export default function ApartmentsPage() {
  const [apartments, setApartments] = useState<ApartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApartments() {
      try {
        const res = await fetch('/api/apartments');
        if (!res.ok) throw new Error('Failed to fetch apartments');
        const data = await res.json();
        setApartments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchApartments();
  }, []);

  if (loading) {
    return <ApartmentsSkeleton />;
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">דירות</h1>
        <Badge variant="outline" className="text-sm">
          {apartments.length} דירות במעקב
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apartments.map((apt) => (
          <Link key={apt.id} href={`/apartments/${apt.number}`}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    דירה {apt.number}
                  </CardTitle>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      התקדמות כללית
                    </span>
                    <span className="text-2xl font-bold">{apt.progress}%</span>
                  </div>
                  <Progress value={apt.progress} className="h-3" />
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded-lg p-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                    <div className="text-lg font-bold text-green-600">
                      {apt.completed}
                    </div>
                    <div className="text-xs text-muted-foreground">הושלמו</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <Clock className="h-4 w-4 text-blue-600 mx-auto" />
                    <div className="text-lg font-bold text-blue-600">
                      {apt.inProgress}
                    </div>
                    <div className="text-xs text-muted-foreground">בטיפול</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mx-auto" />
                    <div className="text-lg font-bold text-orange-600">
                      {apt.defects}
                    </div>
                    <div className="text-xs text-muted-foreground">ליקויים</div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {apt.categoryStats.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    {apt.categoryStats.slice(0, 4).map((cat) => (
                      <CategoryProgressBar
                        key={cat.category}
                        category={
                          categoryHebrewNames[cat.category as WorkCategory] ||
                          cat.category
                        }
                        completed={cat.completed}
                        total={cat.total}
                        color={categoryColors[cat.category as WorkCategory]}
                      />
                    ))}
                    {apt.categoryStats.length > 4 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{apt.categoryStats.length - 4} קטגוריות נוספות
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ApartmentsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
