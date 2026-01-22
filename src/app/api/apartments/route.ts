import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WorkStatus, isPositiveStatus, isNegativeStatus } from '@/lib/status-mapper';

export async function GET() {
  try {
    // Get latest report
    const latestReport = await prisma.report.findFirst({
      where: { processed: true },
      orderBy: { reportDate: 'desc' },
    });

    if (!latestReport) {
      return NextResponse.json([]);
    }

    // Get all apartments with their work items from the latest report
    const apartments = await prisma.apartment.findMany({
      include: {
        workItems: {
          where: { reportId: latestReport.id },
        },
      },
      orderBy: { number: 'asc' },
    });

    const apartmentData = apartments.map((apt) => {
      const total = apt.workItems.length;
      const completed = apt.workItems.filter((item) =>
        isPositiveStatus(item.status as WorkStatus)
      ).length;
      const defects = apt.workItems.filter((item) =>
        isNegativeStatus(item.status as WorkStatus)
      ).length;
      const inProgress = apt.workItems.filter(
        (item) => item.status === WorkStatus.IN_PROGRESS
      ).length;

      // Group by category
      const categoryStats = apt.workItems.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { total: 0, completed: 0 };
        }
        acc[item.category].total++;
        if (isPositiveStatus(item.status as WorkStatus)) {
          acc[item.category].completed++;
        }
        return acc;
      }, {} as Record<string, { total: number; completed: number }>);

      return {
        id: apt.id,
        number: apt.number,
        floor: apt.floor,
        total,
        completed,
        defects,
        inProgress,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
          category,
          ...stats,
          progress: Math.round((stats.completed / stats.total) * 100),
        })),
      };
    });

    // Sort by apartment number (numeric)
    apartmentData.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    return NextResponse.json(apartmentData);
  } catch (error) {
    console.error('Error fetching apartments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch apartments' },
      { status: 500 }
    );
  }
}
