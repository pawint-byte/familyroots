import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Download, Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkUploadDialogProps {
  treeId: string;
  treeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadDialog({ treeId, treeName, open, onOpenChange }: BulkUploadDialogProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ membersCreated: number; relationshipsCreated: number; duplicatesSkipped?: number; skippedNames?: string[]; errors?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (data: string) => {
      const response = await apiRequest("POST", `/api/trees/${treeId}/bulk-upload`, { csvData: data });
      return response as any;
    },
    onSuccess: (data: any) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      const descParts = [];
      if (data.membersCreated > 0) descParts.push(`Created ${data.membersCreated} member${data.membersCreated !== 1 ? 's' : ''}`);
      if (data.relationshipsCreated > 0) descParts.push(`${data.relationshipsCreated} relationship${data.relationshipsCreated !== 1 ? 's' : ''}`);
      if (data.duplicatesSkipped > 0) descParts.push(`Skipped ${data.duplicatesSkipped} duplicate${data.duplicatesSkipped !== 1 ? 's' : ''}`);
      toast({
        title: data.membersCreated > 0 ? "Import complete" : "No new members",
        description: descParts.join('. ') || "All members already exist in this tree",
      });
    },
    onError: (error: any) => {
      const errorData = error?.errors || error?.message;
      if (Array.isArray(errorData)) {
        setResult({ membersCreated: 0, relationshipsCreated: 0, errors: errorData });
      } else {
        toast({
          title: "Upload failed",
          description: typeof errorData === "string" ? errorData : "Check your CSV format and try again",
          variant: "destructive",
        });
      }
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({ description: "Please upload a .csv file", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvData(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    window.open(`/api/trees/${treeId}/bulk-upload/template`, "_blank");
  };

  const handleUpload = () => {
    if (!csvData.trim()) {
      toast({ description: "No CSV data to upload", variant: "destructive" });
      return;
    }
    setResult(null);
    uploadMutation.mutate(csvData);
  };

  const handleClose = () => {
    setCsvData("");
    setFileName(null);
    setResult(null);
    onOpenChange(false);
  };

  const previewLines = csvData
    .split("\n")
    .filter(l => l.trim() && !l.trim().startsWith("#"))
    .slice(0, 10);

  const dataRowCount = csvData
    .split("\n")
    .filter(l => l.trim() && !l.trim().startsWith("#"))
    .length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="title-bulk-upload">
            <Upload className="h-5 w-5" />
            Bulk Upload Members
          </DialogTitle>
          <DialogDescription>
            Import multiple members at once using a CSV file. Download the template for {treeName} to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {!result && (
            <>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="gap-2"
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-csv-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  data-testid="button-choose-file"
                >
                  <FileText className="h-4 w-4" />
                  {fileName || "Choose CSV File"}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Or paste CSV data directly:
                </label>
                <Textarea
                  value={csvData}
                  onChange={(e) => {
                    setCsvData(e.target.value);
                    setFileName(null);
                  }}
                  placeholder={`row_id,first_name,last_name,email,related_to_row_id,relationship_type,qualifier\n1,John,Doe,john@example.com,,,\n2,Jane,Doe,jane@example.com,1,spouse,`}
                  className="font-mono text-xs min-h-[120px]"
                  data-testid="textarea-csv-data"
                />
              </div>

              {csvData && previewLines.length > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Preview</p>
                      <Badge variant="secondary" data-testid="badge-row-count">
                        {dataRowCount > 0 ? `${dataRowCount} row${dataRowCount !== 1 ? 's' : ''}` : 'No data rows'}
                      </Badge>
                    </div>
                    <ScrollArea className="max-h-[150px]">
                      <div className="font-mono text-xs space-y-0.5">
                        {previewLines.map((line, i) => (
                          <div key={i} className={`px-2 py-0.5 rounded ${i === 0 ? 'bg-muted font-medium' : ''}`}>
                            {line.length > 100 ? line.substring(0, 100) + '...' : line}
                          </div>
                        ))}
                        {dataRowCount > 9 && (
                          <div className="px-2 py-0.5 text-muted-foreground">
                            ...and {dataRowCount - 9} more rows
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={handleClose} data-testid="button-cancel-upload">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!csvData.trim() || uploadMutation.isPending}
                  className="gap-2"
                  data-testid="button-upload-csv"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadMutation.isPending ? "Importing..." : "Import Members"}
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              {result.membersCreated > 0 ? (
                <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-400" data-testid="text-import-success">
                          Import successful
                        </p>
                        <p className="text-xs text-green-700/80 dark:text-green-500/80 mt-1">
                          Created {result.membersCreated} member{result.membersCreated !== 1 ? 's' : ''} and {result.relationshipsCreated} relationship{result.relationshipsCreated !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {result.duplicatesSkipped && result.duplicatesSkipped > 0 ? (
                <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-400" data-testid="text-duplicates-skipped">
                          Skipped {result.duplicatesSkipped} duplicate{result.duplicatesSkipped !== 1 ? 's' : ''} already in tree
                        </p>
                        {result.skippedNames && result.skippedNames.length > 0 && (
                          <ScrollArea className="max-h-[100px] mt-2">
                            <p className="text-xs text-amber-700/80 dark:text-amber-500/80">
                              {result.skippedNames.join(', ')}
                            </p>
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {result.errors && result.errors.length > 0 && (
                <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400" data-testid="text-import-errors">
                          {result.membersCreated > 0 ? 'Some issues found' : 'Import failed'}
                        </p>
                        <ScrollArea className="max-h-[150px] mt-2">
                          <ul className="text-xs text-red-700/80 dark:text-red-500/80 space-y-1">
                            {result.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setCsvData("");
                    setFileName(null);
                  }}
                  data-testid="button-upload-another"
                >
                  Upload Another
                </Button>
                <Button onClick={handleClose} data-testid="button-done-upload">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
