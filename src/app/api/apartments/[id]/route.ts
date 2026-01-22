import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WorkStatus, isPositiveStatus, isNegativeStatus } from '@/lib/status-mapper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get apartment by ID or number
    let apartment = await prisma.apartment.findUnique({
      where: { id },
    });

    // If not found by ID, try by number
    if (!apartment) {
      apartment = await prisma.apartment.findFirst({
        where: { number: id },
      });
    }

    if (!apartment) {
      return NextResponse.json(
        { error: 'Apartment not found' },
        { status: 404 }
      );
    }

    // Get all reports ordered by date
    const reports = await prisma.report.findMany({
      where: { processed: true },
      orderBy: { reportDate: 'desc' },
    });

    // Get work items for this apartment across all reports
    const workItemsByReport = await Promise.all(
      reports.map(async (report) => {
        const items = await prisma.workItem.findMany({
          where: {
            reportId: report.id,
            apartmentId: apartment.id,
          },
        });

        const total = items.length;
        const completed = items.filter((item) =>
          isPositiveStatus(item.status as WorkStatus)
        ).length;
        const defects = items.filter((item) =>
          isNegativeStatus(item.status as WorkStatus)
        ).length;

        return {
          reportId: report.id,
          reportDate: report.reportDate,
          total,
          completed,
          defects,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          items: items.map((item) => ({
            id: item.id,
            category: item.category,
            location: item.location,
            description: item.description,
            status: item.status,
            notes: item.notes,
            hasPhoto: item.hasPhoto,
          })),
        };
      })
    );

    // Get latest report data
    const latestReport = workItemsByReport[0];

    // Group latest items by category
    const categoryGroups = latestReport?.items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof latestReport.items>) || {};

    // Calculate progress history for chart
    const progressHistory = workItemsByReport.reverse().map((report) => ({
      date: report.reportDate,
      progress: report.progress,
      completed: report.completed,
      total: report.total,
    }));

    return NextResponse.json({
      apartment: {
        id: apartment.id,
        number: apartment.number,
        floor: apartment.floor,
      },
      latestReport: latestReport
        ? {
            date: latestReport.reportDate,
            total: latestReport.total,
            completed: latestReport.completed,
            defects: latestReport.defects,
            progress: latestReport.progress,
          }
        : null,
      categoryGroups,
      progressHistory,
      allReports: workItemsByReport.reverse(),
    });
  } catch (error) {
    console.error('Error fetching apartment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch apartment' },
      { status: 500 }
    );
  }
}
