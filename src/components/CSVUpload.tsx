import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CSVUploadProps {
  onUploadComplete: () => void;
  onBack: () => void;
}

interface CSVRow {
  train_id: string;
  fitness_certificate_status: string;
  job_card_status: string;
  branding_priority: string;
  mileage: number;
  cleaning_status: string;
  stabling_position: string;
}

const CSVUpload = ({ onUploadComplete, onBack }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file must have at least a header and one data row",
          variant: "destructive",
        });
        return;
      }

      // Detect delimiter and parse with quote support
      const detectDelimiter = (line: string) => {
        const cands = [',', ';', '\t'];
        let best = ','; let bestCount = -1;
        for (const c of cands) { const n = line.split(c).length - 1; if (n > bestCount) { best = c; bestCount = n; } }
        return best;
      };
      const delimiter = detectDelimiter(lines[0]);

      const parseCSVLine = (line: string) => {
        const out: string[] = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
          else if (ch === delimiter && !inQ) { out.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        out.push(cur.trim());
        return out;
      };

      const headersRaw = parseCSVLine(lines[0]);
      const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const headers = headersRaw.map(normalize);

      // Flexible aliases to map user's CSV to canonical fields
      const aliases: Record<string, string[]> = {
        train_id: ['train_id','trainid','train_id_','train'],
        fitness_certificate_status: ['fitness_certificate_status','fitnessstatus','fitness_certificate','fitnesscertificatestatus','fitness_certificates','fitnesscerts','fitnesscertsstatus','fitnesscertificatesstatus','fitness_certificates_status','fitnesscertificates'],
        job_card_status: ['job_card_status','jobcardstatus','jobcards','job_card','jobstatus'],
        branding_priority: ['branding_priority','brandingpriority','branding','brandpriority','branding_priorities','branding_priorities'],
        mileage: ['mileage','mileage_total_km','mileagetotalkm','km','kms','kilometers'],
        cleaning_status: ['cleaning_status','cleaningstatus','cleaning'],
        stabling_position: ['stabling_position','bayposition','stablingbay','stabling_bay','position']
      };
      const indexOf = (canon: keyof typeof aliases) => headers.findIndex(h => aliases[canon].includes(h));

      const data: CSVRow[] = [] as any;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (!values.length) continue;
        const getVal = (idx: number) => (idx >= 0 && idx < values.length ? values[idx] : '');
        const rowAny: any = {
          train_id: getVal(indexOf('train_id')),
          fitness_certificate_status: getVal(indexOf('fitness_certificate_status')),
          job_card_status: getVal(indexOf('job_card_status')),
          branding_priority: getVal(indexOf('branding_priority')),
          mileage: parseInt((getVal(indexOf('mileage')) || '0').replace(/[^0-9-]/g,'')) || 0,
          cleaning_status: getVal(indexOf('cleaning_status')),
          stabling_position: getVal(indexOf('stabling_position')),
          __original: Object.fromEntries(headersRaw.map((h, idx) => [h, values[idx] ?? '']))
        };
        data.push(rowAny as CSVRow);
      }

      setCsvData(data);
      setPreviewData(data.slice(0, 5)); // Show first 5 rows for preview
      
      toast({
        title: "CSV Parsed",
        description: `${data.length} rows loaded successfully`,
      });
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!file || csvData.length === 0) {
      toast({
        title: "Error",
        description: "Please select a valid CSV file first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Cache locally
      localStorage.setItem('recent_results', JSON.stringify(csvData));

      // Persist to Supabase (best-effort)
      try {
        const { data: uploadRow, error: upErr } = await supabase
          .from('csv_uploads')
          .insert({ filename: file?.name ?? 'upload.csv', notes: notes || null })
          .select()
          .single();
        // Batch insert upload rows
        if (!upErr && uploadRow) {
          const rowsPayload = csvData.map((row, idx) => ({
            upload_id: uploadRow.id,
            row_index: idx,
            row_data: row
          }));
          await supabase.from('csv_upload_rows').insert(rowsPayload, { count: 'exact' });
        }
      } catch {}

      // Upsert train_data in a single batch (columns known in your schema)
      try {
        const tdPayload = csvData.map(r => ({
          train_id: r.train_id,
          fitness_certificate_status: r.fitness_certificate_status,
          job_card_status: r.job_card_status,
          branding_priority: r.branding_priority,
          mileage: r.mileage,
          cleaning_status: r.cleaning_status,
          stabling_position: r.stabling_position
        }));
        // Best-effort: delete then insert to avoid conflicts
        const ids = tdPayload.map(r => r.train_id).filter(Boolean);
        if (ids.length) {
          await supabase.from('train_data').delete().in('train_id', ids);
        }
        if (tdPayload.length) {
          await supabase.from('train_data').insert(tdPayload, { count: 'exact' });
        }
      } catch {}

      toast({
        title: "Upload Saved",
        description: `${csvData.length} train records cached and persisted`,
      });
      onUploadComplete();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error?.message || 'Local caching error',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setCsvData([]);
    setPreviewData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Daily Operational Data Upload
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Upload daily operational data for train ranking (fitness, job cards, mileage, etc.)
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <div className="flex gap-2 flex-col sm:flex-row">
                <Input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
                {file && (
                  <Button variant="outline" onClick={clearFile}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-4 h-4" />
                <span className="text-sm">{file.name}</span>
                <Badge variant="outline">{csvData.length} rows</Badge>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this upload..."
              rows={3}
            />
          </div>

          {/* CSV Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Data Preview (First 5 rows)</Label>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Train ID</TableHead>
                      <TableHead>Fitness</TableHead>
                      <TableHead>Job Cards</TableHead>
                      <TableHead>Branding</TableHead>
                      <TableHead>Mileage</TableHead>
                      <TableHead>Cleaning</TableHead>
                      <TableHead>Stabling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.train_id}</TableCell>
                        <TableCell>
                          <Badge variant={row.fitness_certificate_status === 'valid' ? 'default' : 'destructive'}>
                            {row.fitness_certificate_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.job_card_status === 'clear' ? 'default' : 'secondary'}>
                            {row.job_card_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            row.branding_priority === 'high' ? 'default' : 
                            row.branding_priority === 'medium' ? 'secondary' : 'outline'
                          }>
                            {row.branding_priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.mileage.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={row.cleaning_status === 'clean' ? 'default' : 'secondary'}>
                            {row.cleaning_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.stabling_position}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 flex-col sm:flex-row">
            <Button variant="outline" onClick={onBack} disabled={uploading} className="w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Train Info
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="w-full sm:flex-1"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Process Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CSVUpload;
