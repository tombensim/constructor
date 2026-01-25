/**
 * Snapshot Utilities
 * Create and restore database snapshots for rollback capability
 */

import { prisma } from '@/lib/db';

export interface SnapshotData {
  reports: Array<{
    id: string;
    projectId: string;
    reportDate: string;
    fileName: string;
    filePath: string;
    fileHash: string | null;
    inspector: string | null;
    rawExtraction: string | null;
    processed: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  workItems: Array<{
    id: string;
    reportId: string;
    apartmentId: string | null;
    category: string;
    location: string | null;
    description: string;
    status: string;
    notes: string | null;
    hasPhoto: boolean;
    photoNotes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  inspections: Array<{
    id: string;
    reportId: string;
    apartmentId: string;
    category: string;
    inspectionDate: string | null;
    status: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Creates a snapshot of the current database state
 * @param reason - Description of why the snapshot is being created
 * @returns The created snapshot record
 */
export async function createSnapshot(reason: string) {
  // Fetch all current data
  const [reports, workItems, inspections] = await Promise.all([
    prisma.report.findMany({
      orderBy: { reportDate: 'desc' },
    }),
    prisma.workItem.findMany(),
    prisma.inspection.findMany(),
  ]);

  // Serialize dates to ISO strings for JSON storage
  const snapshotData: SnapshotData = {
    reports: reports.map(r => ({
      ...r,
      reportDate: r.reportDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    workItems: workItems.map(w => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    inspections: inspections.map(i => ({
      ...i,
      inspectionDate: i.inspectionDate?.toISOString() || null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
  };

  // Create snapshot record
  const snapshot = await prisma.snapshot.create({
    data: {
      reason,
      data: JSON.stringify(snapshotData),
      reportCount: reports.length,
    },
  });

  return snapshot;
}

/**
 * Restores database state from a snapshot
 * This is a destructive operation - all current data will be replaced
 * @param snapshotId - ID of the snapshot to restore
 * @returns Summary of restored data
 */
export async function restoreSnapshot(snapshotId: string) {
  // Fetch the snapshot
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  const snapshotData: SnapshotData = JSON.parse(snapshot.data);

  // Use a transaction to ensure atomic restoration
  const result = await prisma.$transaction(async (tx) => {
    // Delete all current work items and inspections first (due to foreign keys)
    await tx.workItem.deleteMany({});
    await tx.inspection.deleteMany({});
    
    // Delete all current reports
    await tx.report.deleteMany({});

    // Restore reports
    for (const report of snapshotData.reports) {
      await tx.report.create({
        data: {
          id: report.id,
          projectId: report.projectId,
          reportDate: new Date(report.reportDate),
          fileName: report.fileName,
          filePath: report.filePath,
          fileHash: report.fileHash,
          inspector: report.inspector,
          rawExtraction: report.rawExtraction,
          processed: report.processed,
          createdAt: new Date(report.createdAt),
          updatedAt: new Date(report.updatedAt),
        },
      });
    }

    // Restore work items
    for (const item of snapshotData.workItems) {
      await tx.workItem.create({
        data: {
          id: item.id,
          reportId: item.reportId,
          apartmentId: item.apartmentId,
          category: item.category,
          location: item.location,
          description: item.description,
          status: item.status,
          notes: item.notes,
          hasPhoto: item.hasPhoto,
          photoNotes: item.photoNotes,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
      });
    }

    // Restore inspections
    for (const inspection of snapshotData.inspections) {
      await tx.inspection.create({
        data: {
          id: inspection.id,
          reportId: inspection.reportId,
          apartmentId: inspection.apartmentId,
          category: inspection.category,
          inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate) : null,
          status: inspection.status,
          createdAt: new Date(inspection.createdAt),
          updatedAt: new Date(inspection.updatedAt),
        },
      });
    }

    // Mark snapshot as restored
    await tx.snapshot.update({
      where: { id: snapshotId },
      data: { restoredAt: new Date() },
    });

    return {
      reportsRestored: snapshotData.reports.length,
      workItemsRestored: snapshotData.workItems.length,
      inspectionsRestored: snapshotData.inspections.length,
    };
  });

  return result;
}

/**
 * Get list of available snapshots
 * @param limit - Maximum number of snapshots to return
 */
export async function getSnapshots(limit: number = 10) {
  const snapshots = await prisma.snapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      reason: true,
      reportCount: true,
      createdAt: true,
      restoredAt: true,
    },
  });

  return snapshots;
}

/**
 * Delete old snapshots, keeping the most recent ones
 * @param keepCount - Number of recent snapshots to keep
 */
export async function cleanupOldSnapshots(keepCount: number = 20) {
  const snapshots = await prisma.snapshot.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (snapshots.length <= keepCount) {
    return { deleted: 0 };
  }

  const toDelete = snapshots.slice(keepCount).map(s => s.id);

  await prisma.snapshot.deleteMany({
    where: {
      id: { in: toDelete },
    },
  });

  return { deleted: toDelete.length };
}

/**
 * Get details of a specific snapshot
 */
export async function getSnapshotDetails(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    return null;
  }

  const data: SnapshotData = JSON.parse(snapshot.data);

  return {
    id: snapshot.id,
    reason: snapshot.reason,
    reportCount: snapshot.reportCount,
    createdAt: snapshot.createdAt,
    restoredAt: snapshot.restoredAt,
    details: {
      reports: data.reports.map(r => ({
        fileName: r.fileName,
        reportDate: r.reportDate,
      })),
      workItemCount: data.workItems.length,
      inspectionCount: data.inspections.length,
    },
  };
}
