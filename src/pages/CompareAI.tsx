import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info, X } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Row { 
  train_id: string; pareto_rank: number | null; ai_rank: number | null;
  fitness?: string|null; job_cards?: string|null; branding?: string|null; mileage?: number|null; cleaning?: string|null;
  stabling?: string|null; updated?: string|null; info?: string;
}

const CompareAI = () => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [infoText, setInfoText] = useState<string>('');
  const [infoTitle, setInfoTitle] = useState<string>('Details');
  const [saving, setSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { rows?: Row[] }) || {};
  const rows: Row[] = state.rows || [];
  const { toast } = useToast();

  const saveFinalList = async () => {
    try {
      if (!rows.length) {
        toast({ title: 'No data', description: 'Nothing to save.' });
        return;
      }
      setSaving(true);
      const now = new Date().toISOString();
      const payload = rows.map(r => ({
        train_id: r.train_id,
        pareto_rank: r.pareto_rank,
        ai_rank: r.ai_rank,
        fitness_certificate_status: r.fitness ?? null,
        job_card_status: r.job_cards ?? null,
        branding_priority: r.branding ?? null,
        mileage: typeof r.mileage === 'number' ? Math.trunc(r.mileage) : (r.mileage ?? null),
        cleaning_status: r.cleaning ?? null,
        stabling_position: r.stabling ?? null,
        updated_at: now,
        created_at: now,
      }));
      const { error } = await supabase
        .from('final_train_list')
        .insert(payload);
      if (error) throw error;
      toast({ title: 'Saved', description: `Final list saved with ${payload.length} trains.` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save final list', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!rows.length) { toast({ title: 'No data', description: 'Nothing to export.' }); return; }
    const json = JSON.stringify(rows, null, 2);
    downloadFile(`final_train_list_${Date.now()}.json`, json, 'application/json');
  };

  const toCSV = (items: any[]): string => {
    if (!items.length) return '';
    const headers = Object.keys(items[0]);
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };
    const lines = [headers.join(',')];
    for (const it of items) {
      lines.push(headers.map(h => esc((it as any)[h])).join(','));
    }
    return lines.join('\n');
  };

  const exportCSV = () => {
    if (!rows.length) { toast({ title: 'No data', description: 'Nothing to export.' }); return; }
    const csv = toCSV(rows);
    downloadFile(`final_train_list_${Date.now()}.csv`, csv, 'text/csv');
  };

  const toStr = (v?: string|null) => String(v || '').toLowerCase();
  const groups = { ready: [] as Row[], cleaning: [] as Row[], maintenance: [] as Row[] };
  for (const r of rows) {
    const f = toStr(r.fitness);
    const j = toStr(r.job_cards);
    const c = toStr(r.cleaning);
    let cat: 'ready'|'cleaning'|'maintenance' = 'ready';
    if (f.includes('expired') || f.includes('revoked') || f.includes('invalid')) cat = 'maintenance';
    else if (c.includes('pending') || c.includes('partial')) cat = 'cleaning';
    (groups[cat] as Row[]).push(r);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {showBanner && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-600 text-white uppercase tracking-wide">Notice</span>
            <p className="text-sm">
              Our AI model is currently training on the our latest data. Results may vary temporarily
            </p>
          </div>
          <button
            aria-label="Dismiss notice"
            className="ml-4 text-amber-800/70 hover:text-amber-800 transition-colors"
            onClick={() => setShowBanner(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Comparison</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
            <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
          </div>
          <Button variant="default" onClick={saveFinalList} disabled={saving}>
            {saving ? 'Saving…' : 'Final List'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comparison data. Go to Step 3 and click "Compare with AI".</p>
      ) : (
        <div className="space-y-10">
          {groups.ready.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Revenue Service</h3>
              <div className="overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Train ID</TableHead>
                        <TableHead>Pareto Rank</TableHead>
                        <TableHead>AI Rank</TableHead>
                        <TableHead>Fitness</TableHead>
                        <TableHead>Job Cards</TableHead>
                        <TableHead>Branding</TableHead>
                        <TableHead>Mileage</TableHead>
                        <TableHead>Cleaning</TableHead>
                        <TableHead>Stabling</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.ready.map((row, idx) => (
                        <TableRow key={`r-${idx}`} className="transition-colors hover:bg-muted/40">
                          <TableCell className="font-medium">{row.train_id}</TableCell>
                          <TableCell>{row.pareto_rank ?? '-'}</TableCell>
                          <TableCell>{row.ai_rank != null ? row.ai_rank.toFixed(2) : '-'}</TableCell>
                          <TableCell>{row.fitness ?? '-'}</TableCell>
                          <TableCell>{row.job_cards ?? '-'}</TableCell>
                          <TableCell>{row.branding ?? '-'}</TableCell>
                          <TableCell>{typeof row.mileage === 'number' ? row.mileage.toLocaleString() : (row.mileage ?? '-')}</TableCell>
                          <TableCell>{row.cleaning ?? '-'}</TableCell>
                          <TableCell>{row.stabling ?? '-'}</TableCell>
                          <TableCell>{row.updated ?? '-'}</TableCell>
                          <TableCell>
                            <button
                              title="View explanation and alerts"
                              className="inline-flex items-center text-blue-600 hover:underline"
                              onClick={() => { setInfoTitle(row.train_id || 'Train'); setInfoText(row.info || '—'); setInfoOpen(true); }}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {groups.cleaning.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Cleaning / Detailing</h3>
              <div className="overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Train ID</TableHead>
                        <TableHead>Pareto Rank</TableHead>
                        <TableHead>AI Rank</TableHead>
                        <TableHead>Fitness</TableHead>
                        <TableHead>Job Cards</TableHead>
                        <TableHead>Branding</TableHead>
                        <TableHead>Mileage</TableHead>
                        <TableHead>Cleaning</TableHead>
                        <TableHead>Stabling</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.cleaning.map((row, idx) => (
                        <TableRow key={`c-${idx}`} className="transition-colors hover:bg-muted/40">
                          <TableCell className="font-medium">{row.train_id}</TableCell>
                          <TableCell>{row.pareto_rank ?? '-'}</TableCell>
                          <TableCell>{row.ai_rank != null ? row.ai_rank.toFixed(2) : '-'}</TableCell>
                          <TableCell>{row.fitness ?? '-'}</TableCell>
                          <TableCell>{row.job_cards ?? '-'}</TableCell>
                          <TableCell>{row.branding ?? '-'}</TableCell>
                          <TableCell>{typeof row.mileage === 'number' ? row.mileage.toLocaleString() : (row.mileage ?? '-')}</TableCell>
                          <TableCell>{row.cleaning ?? '-'}</TableCell>
                          <TableCell>{row.stabling ?? '-'}</TableCell>
                          <TableCell>{row.updated ?? '-'}</TableCell>
                          <TableCell>
                            <button
                              title="View explanation and alerts"
                              className="inline-flex items-center text-blue-600 hover:underline"
                              onClick={() => { setInfoTitle(row.train_id || 'Train'); setInfoText(row.info || '—'); setInfoOpen(true); }}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {groups.maintenance.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Inspection Bay (Maintenance)</h3>
              <div className="overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Train ID</TableHead>
                        <TableHead>Pareto Rank</TableHead>
                        <TableHead>AI Rank</TableHead>
                        <TableHead>Fitness</TableHead>
                        <TableHead>Job Cards</TableHead>
                        <TableHead>Branding</TableHead>
                        <TableHead>Mileage</TableHead>
                        <TableHead>Cleaning</TableHead>
                        <TableHead>Stabling</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.maintenance.map((row, idx) => (
                        <TableRow key={`m-${idx}`} className="transition-colors hover:bg-muted/40">
                          <TableCell className="font-medium">{row.train_id}</TableCell>
                          <TableCell>{row.pareto_rank ?? '-'}</TableCell>
                          <TableCell>{row.ai_rank != null ? row.ai_rank.toFixed(2) : '-'}</TableCell>
                          <TableCell>{row.fitness ?? '-'}</TableCell>
                          <TableCell>{row.job_cards ?? '-'}</TableCell>
                          <TableCell>{row.branding ?? '-'}</TableCell>
                          <TableCell>{typeof row.mileage === 'number' ? row.mileage.toLocaleString() : (row.mileage ?? '-')}</TableCell>
                          <TableCell>{row.cleaning ?? '-'}</TableCell>
                          <TableCell>{row.stabling ?? '-'}</TableCell>
                          <TableCell>{row.updated ?? '-'}</TableCell>
                          <TableCell>
                            <button
                              title="View explanation and alerts"
                              className="inline-flex items-center text-blue-600 hover:underline"
                              onClick={() => { setInfoTitle(row.train_id || 'Train'); setInfoText(row.info || '—'); setInfoOpen(true); }}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{infoTitle}</DialogTitle>
            <DialogDescription asChild>
              <div className="whitespace-pre-wrap text-left text-sm">{infoText}</div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompareAI;
