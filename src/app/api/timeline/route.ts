import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WorkStatus, isPositiveStatus, WorkCategory } from '@/lib/status-mapper';

export async function GET() {
  try {
    // Get all processed reports ordered by date
    const reports = await prisma.report.findMany({
      where: { processed: true },
      orderBy: { reportDate: 'asc' },
      include: {
        workItems: {
          include: { apartment: true },
        },
      },
    });

    if (reports.length === 0) {
      return NextResponse.json({
        timelineData: [],
        apartments: [],
        categories: [],
        dateRange: { start: null, end: null },
      });
    }

    // Get unique apartments
    const apartments = await prisma.apartment.findMany({
      orderBy: { number: 'asc' },
    });

    // Calculate progress over time for each apartment
    const timelineData = reports.map((report) => {
      // Group work items by apartment
      const apartmentProgress: Record<
        string,
        { total: number; completed: number; progress: number }
      > = {};

      for (const apt of apartments) {
        const items = report.workItems.filter(
          (item) => item.apartmentId === apt.id
        );
        const total = items.length;
        const completed = items.filter((item) =>
          isPositiveStatus(item.status as WorkStatus)
        ).length;

        apartmentProgress[apt.number] = {
          total,
          completed,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }

      // Overall progress
      const totalItems = report.workItems.length;
      const completedItems = report.workItems.filter((item) =>
        isPositiveStatus(item.status as WorkStatus)
      ).length;

      return {
        date: report.reportDate,
        reportId: report.id,
        overallProgress:
          totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        totalItems,
        completedItems,
        apartmentProgress,
      };
    });

    // Calculate category progress over time
    const categoryProgress = reports.map((report) => {
      const categoryStats: Record<
        string,
        { total: number; completed: number; progress: number }
      > = {};

      // Initialize all categories
      Object.values(WorkCategory).forEach((cat) => {
        categoryStats[cat] = { total: 0, completed: 0, progress: 0 };
      });

      for (const item of report.workItems) {
        if (categoryStats[item.category]) {
          categoryStats[item.category].total++;
          if (isPositiveStatus(item.status as WorkStatus)) {
            categoryStats[item.category].completed++;
          }
        }
      }

      // Calculate progress percentages
      Object.keys(categoryStats).forEach((cat) => {
        const stats = categoryStats[cat];
        stats.progress =
          stats.total > 0
            ? Math.round((stats.completed / stats.total) * 100)
            : 0;
      });

      return {
        date: report.reportDate,
        categories: categoryStats,
      };
    });

    // Get date range
    const dateRange = {
      start: reports[0].reportDate,
      end: reports[reports.length - 1].reportDate,
    };

    return NextResponse.json({
      timelineData,
      categoryProgress,
      apartments: apartments.map((a) => a.number),
      categories: Object.values(WorkCategory),
      dateRange,
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}
