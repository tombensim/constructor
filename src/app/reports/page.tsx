'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Eye,
  Download,
  Upload,
  Loader2,
  Trash2,
  History,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface ReportData {
  id: string;
  fileName: string;
  reportDate: string;
  inspector: string | null;
  total: number;
  completed: number;
  defects: number;
  inProgress: number;
  progress: number;
  progressDelta?: number; // Progress change vs previous report
}

interface SnapshotData {
  id: string;
  reason: string;
  reportCount: number;
  createdAt: string;
  restoredAt: string | null;
}

interface ValidationConfirmation {
  file: File;
  warnings: string[];
  confidence: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    results: { fileName: string; success: boolean; message: string }[];
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Validation confirmation state
  const [validationConfirmOpen, setValidationConfirmOpen] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<ValidationConfirmation | null>(null);

  // Rollback/Snapshot state
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotData | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/reports');
        if (!res.ok) throw new Error('Failed to fetch reports');
        const data = await res.json();
        setReports(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleViewPdf = (report: ReportData) => {
    setSelectedReport(report);
    setPdfDialogOpen(true);
  };

  const handleDownloadPdf = (report: ReportData) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = `/api/reports/${report.id}/pdf?download=true`;
    link.download = report.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uploadSingleFile = async (file: File, force: boolean = false): Promise<{ success: boolean; message: string; requiresConfirmation?: boolean; warnings?: string[]; confidence?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (force) {
      formData.append('force', 'true');
    }

    const res = await fetch('/api/reports/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    // Handle 202 - requires confirmation
    if (res.status === 202 && data.requiresConfirmation) {
      return {
        success: false,
        message: data.message,
        requiresConfirmation: true,
        warnings: data.validationWarnings,
        confidence: data.confidence,
      };
    }

    if (!res.ok) {
      // Include validation details in error message if available
      let errorMsg = data.error || 'שגיאה בהעלאת הקובץ';
      if (data.validationErrors && data.validationErrors.length > 0) {
        errorMsg = data.validationErrors.join(', ');
      }
      return { success: false, message: errorMsg };
    }

    let successMsg = `נוצרו ${data.workItemsCreated} פריטי עבודה`;
    if (data.validation?.warnings?.length > 0) {
      successMsg += ` (${data.validation.warnings.length} אזהרות)`;
    }
    return { success: true, message: successMsg };
  };

  const handleFilesUpload = async (files: File[], forceAll: boolean = false) => {
    // Filter PDF files only
    const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      setUploadProgress({
        current: 0,
        total: 0,
        currentFile: '',
        results: [{ fileName: 'N/A', success: false, message: 'יש להעלות קבצי PDF בלבד' }],
      });
      return;
    }

    setUploading(true);
    setUploadProgress({
      current: 0,
      total: pdfFiles.length,
      currentFile: pdfFiles[0].name,
      results: [],
    });

    const results: { fileName: string; success: boolean; message: string }[] = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];

      setUploadProgress(prev => prev ? {
        ...prev,
        current: i,
        currentFile: file.name,
      } : null);

      try {
        const result = await uploadSingleFile(file, forceAll);

        // If requires confirmation and not forcing, pause for user input
        if (result.requiresConfirmation && !forceAll) {
          setUploading(false);
          setPendingValidation({
            file,
            warnings: result.warnings || [],
            confidence: result.confidence || 'low',
          });
          setValidationConfirmOpen(true);

          // Store remaining files for later
          const remainingFiles = pdfFiles.slice(i + 1);
          if (remainingFiles.length > 0) {
            // We'll handle remaining files after confirmation
          }
          return; // Exit the loop - user needs to confirm
        }

        results.push({
          fileName: file.name,
          success: result.success,
          message: result.message,
        });
      } catch (err) {
        results.push({
          fileName: file.name,
          success: false,
          message: err instanceof Error ? err.message : 'שגיאה לא ידועה',
        });
      }

      setUploadProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        results: [...results],
      } : null);
    }

    // Refresh reports list
    const reportsRes = await fetch('/api/reports');
    if (reportsRes.ok) {
      const reportsData = await reportsRes.json();
      setReports(reportsData);
    }

    setUploading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(Array.from(e.target.files));
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Error refreshing reports:', err);
    }
  };

  // Handle validation confirmation - user chose to proceed despite warnings
  const handleValidationConfirm = async () => {
    if (!pendingValidation) return;

    setValidationConfirmOpen(false);
    setUploading(true);

    try {
      const result = await uploadSingleFile(pendingValidation.file, true);

      setUploadProgress(prev => prev ? {
        ...prev,
        current: (prev.current || 0) + 1,
        results: [...(prev.results || []), {
          fileName: pendingValidation.file.name,
          success: result.success,
          message: result.message,
        }],
      } : {
        current: 1,
        total: 1,
        currentFile: pendingValidation.file.name,
        results: [{
          fileName: pendingValidation.file.name,
          success: result.success,
          message: result.message,
        }],
      });

      // Refresh reports list
      const reportsRes = await fetch('/api/reports');
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
    } catch (err) {
      console.error('Error uploading after confirmation:', err);
    } finally {
      setUploading(false);
      setPendingValidation(null);
    }
  };

  // Handle validation rejection - user chose not to proceed
  const handleValidationReject = () => {
    setValidationConfirmOpen(false);
    setPendingValidation(null);
    setUploadProgress(prev => prev ? {
      ...prev,
      results: [...(prev.results || []), {
        fileName: pendingValidation?.file.name || 'Unknown',
        success: false,
        message: 'בוטל על ידי המשתמש בעקבות אזהרות',
      }],
    } : null);
  };

  // Fetch available snapshots
  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch('/api/snapshots?limit=15');
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data);
      }
    } catch (err) {
      console.error('Error fetching snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  // Open rollback dialog
  const handleOpenRollback = () => {
    setRollbackDialogOpen(true);
    fetchSnapshots();
  };

  // Perform rollback
  const handleRollback = async () => {
    if (!selectedSnapshot) return;

    setRollingBack(true);
    try {
      const res = await fetch('/api/snapshots/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: selectedSnapshot.id }),
      });

      if (res.ok) {
        // Refresh reports after rollback
        await handleRefresh();
        setRollbackDialogOpen(false);
        setSelectedSnapshot(null);
      } else {
        const data = await res.json();
        console.error('Rollback failed:', data.error);
      }
    } catch (err) {
      console.error('Error during rollback:', err);
    } finally {
      setRollingBack(false);
    }
  };

  const handleDeleteClick = (report: ReportData) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${reportToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh reports list
        await handleRefresh();
        setDeleteDialogOpen(false);
        setReportToDelete(null);
      } else {
        const data = await res.json();
        console.error('Error deleting report:', data.error);
      }
    } catch (err) {
      console.error('Error deleting report:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <ReportsSkeleton />;
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
        <h1 className="text-3xl font-bold">דוחות</h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {reports.length} דוחות
          </Badge>
          <Button
            variant="outline"
            onClick={handleOpenRollback}
            title="שחזור מגיבוי"
          >
            <History className="h-4 w-4 ml-2" />
            שחזור
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 ml-2" />
            העלאת דוח
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-3xl font-bold">{reports.length}</div>
                  <p className="text-sm text-muted-foreground">סה״כ דוחות</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-lg font-bold">
                    {new Date(reports[0].reportDate).toLocaleDateString('he-IL')}
                  </div>
                  <p className="text-sm text-muted-foreground">דוח אחרון</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {reports[0].progress}%
                  </div>
                  <p className="text-sm text-muted-foreground">התקדמות נוכחית</p>
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
                    {reports[0].defects}
                  </div>
                  <p className="text-sm text-muted-foreground">ליקויים פתוחים</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            רשימת דוחות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם קובץ</TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>התקדמות</TableHead>
                <TableHead className="text-center">התקדמות לדוח</TableHead>
                <TableHead className="text-center">
                  <CheckCircle2 className="h-4 w-4 inline ml-1" />
                  הושלמו
                </TableHead>
                <TableHead className="text-center">
                  <Clock className="h-4 w-4 inline ml-1" />
                  בטיפול
                </TableHead>
                <TableHead className="text-center">
                  <AlertTriangle className="h-4 w-4 inline ml-1" />
                  ליקויים
                </TableHead>
                <TableHead className="text-center">סה״כ</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, index) => (
                <TableRow
                  key={report.id}
                  className={index === 0 ? 'bg-blue-50' : ''}
                >
                  <TableCell className="font-medium max-w-xs">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          אחרון
                        </Badge>
                      )}
                      <span className="truncate">{report.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(report.reportDate).toLocaleDateString('he-IL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-32">
                      <Progress value={report.progress} className="h-2 flex-1" />
                      <span className="text-sm font-medium w-12">
                        {report.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        (report.progressDelta ?? 0) > 0
                          ? "bg-green-50 text-green-700"
                          : (report.progressDelta ?? 0) < 0
                            ? "bg-red-50 text-red-700"
                            : "bg-orange-50 text-orange-600"
                      }
                    >
                      {(report.progressDelta ?? 0) > 0
                        ? `+${report.progressDelta}%`
                        : (report.progressDelta ?? 0) < 0
                          ? `${report.progressDelta}%`
                          : "Zero"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {report.completed}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {report.inProgress}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={report.defects > 0 ? 'destructive' : 'outline'}
                    >
                      {report.defects}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {report.total}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPdf(report)}
                        title="צפייה בדוח"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadPdf(report)}
                        title="הורדה"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(report)}
                        title="מחיקה"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PDF Viewer Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedReport && (
                <span>
                  {new Date(selectedReport.reportDate).toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {selectedReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPdf(selectedReport)}
                >
                  <Download className="h-4 w-4 ml-2" />
                  הורדה
                </Button>
              )}
              <DialogClose onClick={() => setPdfDialogOpen(false)} />
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-b-lg">
            {selectedReport && (
              <iframe
                src={`/api/reports/${selectedReport.id}/pdf`}
                className="w-full h-full border-0"
                title={`PDF Viewer - ${selectedReport.fileName}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {reports.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              אין דוחות זמינים. יש לעבד את קבצי ה-PDF תחילה.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        if (!uploading) {
          setUploadDialogOpen(open);
          if (!open) {
            setUploadProgress(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              העלאת דוחות
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !uploading && document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileInput}
                disabled={uploading}
              />

              {uploading && uploadProgress ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    מעבד קובץ {uploadProgress.current + 1} מתוך {uploadProgress.total}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {uploadProgress.currentFile}
                  </p>
                  <Progress
                    value={(uploadProgress.current / uploadProgress.total) * 100}
                    className="h-2 w-full max-w-xs"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">גרור קבצי PDF לכאן</p>
                    <p className="text-sm text-muted-foreground">או לחץ לבחירת קבצים (ניתן לבחור מספר קבצים)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Results */}
            {uploadProgress && uploadProgress.results.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium">תוצאות העלאה:</p>
                {uploadProgress.results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate flex-1" title={result.fileName}>
                      {result.fileName}
                    </span>
                    <span className="text-xs flex-shrink-0">{result.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Summary after completion */}
            {uploadProgress && !uploading && uploadProgress.results.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm">
                  הושלם: {uploadProgress.results.filter(r => r.success).length} הצליחו, {' '}
                  {uploadProgress.results.filter(r => !r.success).length} נכשלו
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadProgress(null)}
                >
                  העלאה נוספת
                </Button>
              </div>
            )}

            {/* Info - only show when not showing results */}
            {(!uploadProgress || uploadProgress.results.length === 0) && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• קבצי PDF בלבד</p>
                <p>• ניתן להעלות מספר קבצים בו-זמנית</p>
                <p>• קבצים כפולים (לפי שם) לא יתווספו</p>
                <p>• הדוחות יעובדו אוטומטית ויתווספו למערכת</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!deleting) {
          setDeleteDialogOpen(open);
          if (!open) {
            setReportToDelete(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              מחיקת דוח
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm">
              האם אתה בטוח שברצונך למחוק את הדוח הבא?
            </p>

            {reportToDelete && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">
                  {new Date(reportToDelete.reportDate).toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {reportToDelete.fileName}
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 inline ml-1" />
              פעולה זו תמחק את הדוח וכל הנתונים הקשורים אליו. לא ניתן לבטל פעולה זו.
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                ביטול
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    מוחק...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק דוח
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Confirmation Dialog */}
      <Dialog open={validationConfirmOpen} onOpenChange={(open) => {
        if (!open) handleValidationReject();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ShieldAlert className="h-5 w-5" />
              נמצאו אזהרות באימות הקובץ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {pendingValidation && (
              <>
                <p className="text-sm">
                  הקובץ <span className="font-medium">{pendingValidation.file.name}</span> עבר אימות בסיסי, אך נמצאו האזהרות הבאות:
                </p>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pendingValidation.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 text-orange-700 text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm">
                    <span className="font-medium">רמת ביטחון: </span>
                    <Badge variant={pendingValidation.confidence === 'low' ? 'destructive' : 'outline'}>
                      {pendingValidation.confidence === 'high' ? 'גבוהה' :
                        pendingValidation.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
                    </Badge>
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  האם להמשיך בהעלאת הקובץ למרות האזהרות?
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleValidationReject}
              >
                ביטול
              </Button>
              <Button
                variant="default"
                onClick={handleValidationConfirm}
              >
                <ShieldCheck className="h-4 w-4 ml-2" />
                המשך בכל זאת
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={(open) => {
        if (!rollingBack) {
          setRollbackDialogOpen(open);
          if (!open) setSelectedSnapshot(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              שחזור מגיבוי
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground">
              בחר נקודת גיבוי לשחזור. גיבויים נוצרים אוטומטית לפני כל העלאת דוח.
            </p>

            {loadingSnapshots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                אין גיבויים זמינים
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>סיבה</TableHead>
                      <TableHead className="text-center">דוחות</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow
                        key={snapshot.id}
                        className={`cursor-pointer ${selectedSnapshot?.id === snapshot.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedSnapshot(snapshot)}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            checked={selectedSnapshot?.id === snapshot.id}
                            onChange={() => setSelectedSnapshot(snapshot)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(snapshot.createdAt).toLocaleString('he-IL', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate" title={snapshot.reason}>
                          {snapshot.reason}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{snapshot.reportCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {snapshot.restoredAt ? (
                            <Badge variant="secondary" className="text-xs">
                              שוחזר ב-{new Date(snapshot.restoredAt).toLocaleDateString('he-IL')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600">
                              זמין
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedSnapshot && (
              <div className="p-3 rounded-lg bg-orange-50 text-orange-700 text-sm">
                <AlertTriangle className="h-4 w-4 inline ml-1" />
                שחזור יחליף את כל הנתונים הנוכחיים בנתונים מהגיבוי שנבחר. פעולה זו לא ניתנת לביטול.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRollbackDialogOpen(false)}
                disabled={rollingBack}
              >
                ביטול
              </Button>
              <Button
                variant="destructive"
                onClick={handleRollback}
                disabled={!selectedSnapshot || rollingBack}
              >
                {rollingBack ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    משחזר...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 ml-2" />
                    שחזר גיבוי
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
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
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
