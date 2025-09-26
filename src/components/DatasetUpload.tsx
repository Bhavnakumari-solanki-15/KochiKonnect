import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Merge, Database, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadCSV, downloadJSON, toCSV } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Category = 'fitness' | 'jobcards' | 'branding' | 'mileage' | 'cleaning' | 'stabling';

interface DatasetUploadProps {
  onBack?: () => void;
  onMerged?: (rows: any[]) => void;
  onGoToCSVUpload?: () => void;
  onProceedResults?: () => void;
}

interface ParsedRow {
  train_id: string;
  [key: string]: any;
}

const CATEGORY_LABEL: Record<Category, string> = {
  fitness: 'Fitness Certificates',
  jobcards: 'Job Cards',
  branding: 'Branding Priority',
  mileage: 'Mileage Data',
  cleaning: 'Cleaning Status',
  stabling: 'Stabling Position'
};

const DatasetUpload = ({ onBack, onMerged, onGoToCSVUpload, onProceedResults }: DatasetUploadProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<Partial<Record<Category, File>>>({});
  const [rowsByCat, setRowsByCat] = useState<Partial<Record<Category, ParsedRow[]>>>({});
  const [mergedRows, setMergedRows] = useState<any[] | null>(null);
  const [exportEnabled, setExportEnabled] = useState(false);
  const inputRefs = useRef<Partial<Record<Category, HTMLInputElement | null>>>({});

  const allComplete = useMemo(() => (
    ['fitness','jobcards','branding','mileage','cleaning','stabling']
      .every(c => (rowsByCat as any)[c]?.length)
  ), [rowsByCat]);

  const parseCSVText = (text: string): { headers: string[]; rows: string[][] } => {
    if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const detectDelimiter = (line: string) => {
      const cands = [',', ';', '\t'];
      let best = ','; let bestCount = -1;
      for (const c of cands) { const n = line.split(c).length - 1; if (n > bestCount) { best = c; bestCount = n; } }
      return best;
    };
    const delim = lines.length ? detectDelimiter(lines[0]) : ',';
    const parseLine = (line: string) => {
      const out: string[] = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
        else if (ch === delim && !inQ) { out.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      out.push(cur.trim());
      return out;
    };
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const parseCategory = (cat: Category, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = String(e.target?.result || '');
      const { headers, rows } = parseCSVText(text);
      if (!headers.length || !rows.length) {
        toast({ title: 'Invalid CSV', description: `${CATEGORY_LABEL[cat]} file is empty`, variant: 'destructive' });
        return;
      }
      const headersNorm = headers.map(normalize);
      const idxTrain = headersNorm.findIndex(h => ['train_id','trainid','train'].includes(h));
      if (idxTrain === -1) {
        toast({ title: 'Missing Train ID', description: `${CATEGORY_LABEL[cat]} must include a Train ID column`, variant: 'destructive' });
        return;
      }
      const pickField = (c: Category) => {
        const alias: Record<Category, string[]> = {
          fitness: ['fitness_certificate_status','fitnessstatus','fitness_certificate','fitness_certificates_status','fitnesscertificatestatus','fitness','fitness_status','certificate_status'],
          jobcards: ['job_card_status','jobcards','job_cards','jobstatus','job_card','job_card_state','job_cards_status','job_card_status_updated','work_order_status','job_status','status'],
          branding: ['branding_priority','branding','brandpriority'],
          mileage: ['mileage','mileage_total_km','mileagetotalkm','km','kilometers','total_mileage','mileage_total'],
          cleaning: ['cleaning_status','cleaning'],
          stabling: ['stabling_position','bay_position','stabling_bay','position']
        };
        for (const a of alias[c]) {
          const i = headersNorm.indexOf(a);
          if (i !== -1) return i;
        }
        if (c === 'jobcards') {
          let best = -1;
          headersNorm.forEach((h, i) => {
            if ((h.includes('job') && h.includes('status')) || h === 'status') best = best === -1 ? i : best;
            if (h === 'jobcards') best = best === -1 ? i : best;
          });
          return best;
        }
        return -1;
      };
      const idxField = pickField(cat);
      const parsed: ParsedRow[] = rows.map(vals => {
        const train_id = String(vals[idxTrain] || '').trim();
        const base: any = { train_id };
        headers.forEach((h, i) => { base[h] = String(vals[i] ?? '').trim(); });
        if (cat === 'fitness') base.fitness_certificate_status = idxField >= 0 ? String(vals[idxField] || '').trim() : '';
        if (cat === 'jobcards') {
          let val = idxField >= 0 ? String(vals[idxField] || '').trim() : '';
          if (!val) {
            for (let i = 0; i < headersNorm.length; i++) {
              const h = headersNorm[i];
              if ((h.includes('job') && h.includes('status')) || h === 'status') {
                val = String(vals[i] || '').trim();
                if (val) break;
              }
            }
          }
          base.job_card_status = val;
        }
        if (cat === 'branding') base.branding_priority = idxField >= 0 ? String(vals[idxField] || '').trim() : '';
        if (cat === 'mileage') {
          const raw = idxField >= 0 ? String(vals[idxField] || '').trim() : '0';
          base.mileage = parseInt(raw.replace(/[^0-9-]/g,'')) || 0;
        }
        if (cat === 'cleaning') base.cleaning_status = idxField >= 0 ? String(vals[idxField] || '').trim() : '';
        if (cat === 'stabling') base.stabling_position = idxField >= 0 ? String(vals[idxField] || '').trim() : '';
        return base;
      });
      setRowsByCat(prev => ({ ...prev, [cat]: parsed }));
      try { localStorage.setItem(`dataset_${cat}`, JSON.stringify({ filename: file.name, rows: parsed, uploadedAt: new Date().toISOString() })); } catch {}
      toast({ title: `${CATEGORY_LABEL[cat]} loaded`, description: `${parsed.length} rows parsed` });
    };
    reader.readAsText(file);
  };

  const onSelect = (cat: Category, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFiles(prev => ({ ...prev, [cat]: f }));
    setMergedRows(null);
    setExportEnabled(false);
    parseCategory(cat, f);
  };

  const handleMergeAll = () => {
    if (!allComplete) {
      toast({ title: 'Awaiting all files', description: 'Upload all six categories before merging', variant: 'destructive' });
      return;
    }
    const ids = new Set<string>();
    Object.values(rowsByCat).forEach(arr => (arr || []).forEach(r => ids.add(String(r.train_id || '').trim())));
    const out: any[] = [];
    ids.forEach(id => {
      const row: any = { train_id: id };
      const pick = (cat: Category, key: string) => {
        const arr = (rowsByCat as any)[cat] as ParsedRow[] | undefined;
        if (!arr) return;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (String(arr[i].train_id).trim() === id) {
            const v = (arr[i] as any)[key];
            if (v !== undefined && v !== null && String(v) !== '') { row[key] = v; return; }
          }
        }
      };
      pick('fitness','fitness_certificate_status');
      pick('jobcards','job_card_status');
      pick('branding','branding_priority');
      pick('mileage','mileage');
      pick('cleaning','cleaning_status');
      pick('stabling','stabling_position');
      if (!('fitness_certificate_status' in row) || String(row.fitness_certificate_status).trim() === '') row.fitness_certificate_status = 'Unknown';
      if (!('job_card_status' in row) || String(row.job_card_status).trim() === '') row.job_card_status = 'Unknown';
      if (!('branding_priority' in row) || String(row.branding_priority).trim() === '') row.branding_priority = 'Unknown';
      if (!('mileage' in row) || row.mileage === '' || row.mileage === null || isNaN(Number(row.mileage))) row.mileage = 0;
      if (!('cleaning_status' in row) || String(row.cleaning_status).trim() === '') row.cleaning_status = 'Unknown';
      if (!('stabling_position' in row) || String(row.stabling_position).trim() === '') row.stabling_position = 'Unknown';
      out.push(row);
    });
    out.sort((a, b) => String(a.train_id).localeCompare(String(b.train_id)));
    setMergedRows(out);
    setExportEnabled(true);
    onMerged?.(out);
    try { localStorage.setItem('merged_dataset', JSON.stringify({ rows: out, mergedAt: new Date().toISOString() })); } catch {}
    try {
      const csv = toCSV(out as any);
      const payload = { filename: 'dataset_merged.csv', csv, createdAt: new Date().toISOString() };
      localStorage.setItem('prefill_csv', JSON.stringify(payload));
    } catch {}
    toast({ title: 'Merged', description: `${out.length} trains merged with no duplicates` });
  };

  const saveToDatabase = async () => {
    if (!mergedRows || !mergedRows.length) {
      toast({ title: 'Nothing to save', description: 'Please Merge All first', variant: 'destructive' });
      return;
    }
    try {
      const payload = mergedRows.map((r: any) => ({
        train_id: r.train_id,
        fitness_certificate_status: r.fitness_certificate_status,
        job_card_status: r.job_card_status,
        branding_priority: r.branding_priority,
        mileage: typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage||'0'))||0,
        cleaning_status: r.cleaning_status,
        stabling_position: r.stabling_position
      }));
      const { error } = await supabase.from('merged_file_table').insert(payload);
      if (error) throw error;
      toast({ title: 'Saved', description: `Inserted ${payload.length} merged rows into database` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save merged data', variant: 'destructive' });
    }
  };

  const downloadDummyData = async () => {
    try {
      const url = 'https://asnrihqbhtaqwxqubmjx.supabase.co/storage/v1/object/public/DummyData/DummyData.zip';
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DummyData.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Download started', description: 'DummyData.zip is downloading.' });
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message || 'Could not start download', variant: 'destructive' });
    }
  };

  const previewRows = useMemo(() => (mergedRows ?? [] as any[]).slice(0, 5), [mergedRows]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Dataset Upload
            </CardTitle>
            <Button variant="outline" onClick={downloadDummyData} className="w-full sm:w-auto">
              <Package className="w-4 h-4 mr-2" />
              Dummy Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
              <div key={cat} className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-semibold">{CATEGORY_LABEL[cat]}</Label>
                  {rowsByCat[cat]?.length ? (
                    <Badge variant="outline">{rowsByCat[cat]?.length} rows</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <Input
                    ref={(el) => (inputRefs.current[cat] = el)}
                    type="file"
                    accept=".csv"
                    onChange={(e) => onSelect(cat, e)}
                    className="flex-1"
                  />
                  {files[cat] && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4" />
                      <span className="truncate max-w-[12rem]" title={files[cat]!.name}>{files[cat]!.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleMergeAll} disabled={!allComplete} className="w-full sm:w-auto">
              <Merge className="w-4 h-4 mr-2" />
              Merge All
            </Button>
            <Button variant="outline" disabled={!exportEnabled} onClick={() => mergedRows && downloadCSV('dataset_merged.csv', mergedRows)} className="w-full sm:w-auto">
              Export CSV
            </Button>
            <Button variant="outline" disabled={!exportEnabled} onClick={() => mergedRows && downloadJSON('dataset_merged.json', mergedRows)} className="w-full sm:w-auto">
              Export JSON
            </Button>
            <Button variant="default" disabled={!exportEnabled} onClick={saveToDatabase} className="w-full sm:w-auto">
              <Database className="w-4 h-4 mr-2" />
              Save to Database
            </Button>
            <Button
              variant="default"
              disabled={!exportEnabled}
              className="w-full sm:w-auto"
              onClick={async () => {
                try {
                  // Persist to Supabase only (no localStorage)
                  if (mergedRows && mergedRows.length) {
                    try {
                      const { data: uploadRow, error: upErr } = await supabase
                        .from('csv_uploads')
                        .insert({ filename: 'dataset_merged.csv', notes: 'Merged via DatasetUpload' })
                        .select()
                        .single();
                      if (!upErr && uploadRow) {
                        const rowsPayload = mergedRows.map((row: any, idx: number) => ({
                          upload_id: uploadRow.id,
                          row_index: idx,
                          row_data: row
                        }));
                        await supabase.from('csv_upload_rows').insert(rowsPayload, { count: 'exact' });
                      }
                    } catch {}

                    try {
                      const tdPayload = (mergedRows as any[]).map(r => ({
                        train_id: r.train_id,
                        fitness_certificate_status: r.fitness_certificate_status,
                        job_card_status: r.job_card_status,
                        branding_priority: r.branding_priority,
                        mileage: typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage||'0'))||0,
                        cleaning_status: r.cleaning_status,
                        stabling_position: r.stabling_position
                      }));
                      const ids = tdPayload.map(r => r.train_id).filter(Boolean);
                      if (ids.length) {
                        await supabase.from('train_data').delete().in('train_id', ids);
                      }
                      if (tdPayload.length) {
                        await supabase.from('train_data').insert(tdPayload, { count: 'exact' });
                      }
                    } catch {}
                  }
                } catch {}
                if (typeof onProceedResults === 'function') onProceedResults();
              }}
            >
              Proceed with this data
            </Button>
          </div>

          {mergedRows && (
            <div className="space-y-2">
              <Label>Preview (First 5 rows)</Label>
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
                    {previewRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.train_id}</TableCell>
                        <TableCell>{r.fitness_certificate_status ?? '-'}</TableCell>
                        <TableCell>{r.job_card_status ?? '-'}</TableCell>
                        <TableCell>{r.branding_priority ?? '-'}</TableCell>
                        <TableCell>{typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-')}</TableCell>
                        <TableCell>{r.cleaning_status ?? '-'}</TableCell>
                        <TableCell>{r.stabling_position ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatasetUpload;


