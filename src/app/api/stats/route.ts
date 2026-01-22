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
      return NextResponse.json({
        totalReports: 0,
        totalApartments: 0,
        overallProgress: 0,
        completedItems: 0,
        defectItems: 0,
        inProgressItems: 0,
        categoryStats: [],
        apartmentStats: [],
        recentDefects: [],
      });
    }

    // Get all reports count
    const totalReports = await prisma.report.count({
      where: { processed: true },
    });

    // Get apartments count
    const totalApartments = await prisma.apartment.count();

    // Get work items from latest report
    const workItems = await prisma.workItem.findMany({
      where: { reportId: latestReport.id },
      include: { apartment: true },
    });

    // Calculate status counts
    const completedItems = workItems.filter((item) =>
      isPositiveStatus(item.status as WorkStatus)
    ).length;
    const defectItems = workItems.filter((item) =>
      isNegativeStatus(item.status as WorkStatus)
    ).length;
    const inProgressItems = workItems.filter(
      (item) => item.status === WorkStatus.IN_PROGRESS
    ).length;

    // Calculate overall progress (completed / total)
    const totalItems = workItems.length;
    const overallProgress = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    // Get category stats
    const categoryGroups = workItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { total: 0, completed: 0 };
      }
      acc[item.category].total++;
      if (isPositiveStatus(item.status as WorkStatus)) {
        acc[item.category].completed++;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    const categoryStats = Object.entries(categoryGroups).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
      progress: Math.round((stats.completed / stats.total) * 100),
    }));

    // Get apartment stats
    const apartmentGroups = workItems.reduce((acc, item) => {
      const aptNum = item.apartment?.number || 'פיתוח';
      if (!acc[aptNum]) {
        acc[aptNum] = { total: 0, completed: 0, defects: 0 };
      }
      acc[aptNum].total++;
      if (isPositiveStatus(item.status as WorkStatus)) {
        acc[aptNum].completed++;
      }
      if (isNegativeStatus(item.status as WorkStatus)) {
        acc[aptNum].defects++;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number; defects: number }>);

    const apartmentStats = Object.entries(apartmentGroups).map(([number, stats]) => ({
      number,
      total: stats.total,
      completed: stats.completed,
      defects: stats.defects,
      progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));

    // Sort apartment stats by apartment number
    apartmentStats.sort((a, b) => {
      if (a.number === 'פיתוח') return 1;
      if (b.number === 'פיתוח') return -1;
      return parseInt(a.number) - parseInt(b.number);
    });

    // Get recent defects
    const recentDefects = workItems
      .filter((item) => isNegativeStatus(item.status as WorkStatus))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        apartment: item.apartment?.number || 'פיתוח',
        category: item.category,
        description: item.description,
        status: item.status,
      }));

    return NextResponse.json({
      totalReports,
      totalApartments,
      overallProgress,
      completedItems,
      defectItems,
      inProgressItems,
      totalItems,
      categoryStats,
      apartmentStats,
      recentDefects,
      latestReportDate: latestReport.reportDate,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
