import { NextRequest, NextResponse } from 'next/server';
import { restoreSnapshot, getSnapshotDetails } from '@/lib/snapshot';

/**
 * POST /api/snapshots/rollback - Restore database from a snapshot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshotId } = body;

    if (!snapshotId) {
      return NextResponse.json(
        { error: 'Snapshot ID is required' },
        { status: 400 }
      );
    }

    // Get snapshot details first to verify it exists
    const snapshotDetails = await getSnapshotDetails(snapshotId);
    if (!snapshotDetails) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    // Perform the rollback
    const result = await restoreSnapshot(snapshotId);

    return NextResponse.json({
      success: true,
      message: 'המערכת שוחזרה בהצלחה',
      snapshotId,
      snapshotDate: snapshotDetails.createdAt,
      snapshotReason: snapshotDetails.reason,
      restored: {
        reports: result.reportsRestored,
        workItems: result.workItemsRestored,
        inspections: result.inspectionsRestored,
      },
    });
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore snapshot' },
      { status: 500 }
    );
  }
}
