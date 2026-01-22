import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WorkStatus, isPositiveStatus, isNegativeStatus } from '@/lib/status-mapper';

export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      where: { processed: true },
      orderBy: { reportDate: 'desc' },
      include: {
        workItems: true,
      },
    });

    const reportData = reports.map((report) => {
      const total = report.workItems.length;
      const completed = report.workItems.filter((item) =>
        isPositiveStatus(item.status as WorkStatus)
      ).length;
      const defects = report.workItems.filter((item) =>
        isNegativeStatus(item.status as WorkStatus)
      ).length;
      const inProgress = report.workItems.filter(
        (item) => item.status === WorkStatus.IN_PROGRESS
      ).length;

      return {
        id: report.id,
        fileName: report.fileName,
        reportDate: report.reportDate,
        inspector: report.inspector,
        total,
        completed,
        defects,
        inProgress,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
