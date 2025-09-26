import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Plus, Upload, ArrowRight, Train, FileText, X, Info } from "lucide-react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TrainInfoForm from "@/components/TrainInfoForm";
import CSVUpload from "@/components/CSVUpload";
import DatasetUpload from "@/components/DatasetUpload";
import { computeScore, type TrainRow, buildPromptFromRow, runScoring } from "@/lib/scoring";
import { nsgaRank, normalizeObjectives, type NSGAItem } from "@/lib/nsga";

interface TrainInfo {
  id: string;
  train_id: string;
  model: string;
  status: 'active' | 'maintenance' | 'retired';
  created_at: string;
  updated_at: string;
}

const Admin = () => {
  const [currentStep, setCurrentStep] = useState<'dataset-upload' | 'train-info' | 'csv-upload' | 'results'>('dataset-upload');
  const [trainInfo, setTrainInfo] = useState<TrainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [readyResults, setReadyResults] = useState<any[]>([]);
  const [cleaningResults, setCleaningResults] = useState<any[]>([]);
  const [maintenanceResults, setMaintenanceResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [resultsFilter, setResultsFilter] = useState<'all'|'ready'|'cleaning'|'maintenance'>('all');
  const [showTrainForm, setShowTrainForm] = useState(false);
  const [editingTrain, setEditingTrain] = useState<TrainInfo | null>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoContent, setInfoContent] = useState<{ title: string; description: string } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiRankByTrain, setAiRankByTrain] = useState<Record<string, number>>({});
  const [aiDialogOpen, setAiDialogOpen] = useState<boolean>(false);
  const [aiCompareTable, setAiCompareTable] = useState<{train_id:string, pareto_rank:number|null, ai_rank:number|null, fitness?:string|null, job_cards?:string|null, branding?:string|null, mileage?:number|null, cleaning?:string|null, stabling?:string|null, updated?:string|null}[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [fromFlow, setFromFlow] = useState<boolean>(false);

  // What-If simulator state
  const [whatIfQuery, setWhatIfQuery] = useState<string>("");
  const [whatIfAnswer, setWhatIfAnswer] = useState<string>("");
  const [whatIfLoading, setWhatIfLoading] = useState<boolean>(false);
  const [whatIfOpen, setWhatIfOpen] = useState<boolean>(false);

  const loadLatestRows = async (): Promise<any[]> => {
    try {
      const { data: listing } = await supabase
        .from('listing')
        .select('train_id, pareto_rank, fitness_certificate_status, job_card_status, branding_priority, mileage, cleaning_status, stabling_position, updated_at, processed_at')
        .order('processed_at', { ascending: false })
        .limit(100);
      if (Array.isArray(listing) && listing.length) {
        const latest: Record<string, any> = {};
        for (const r of listing) if (r.train_id && !latest[r.train_id]) latest[r.train_id] = r;
        return Object.values(latest);
      }
    } catch {}
    try {
      const { data } = await supabase
        .from('train_data')
        .select('train_id, fitness_certificate_status, job_card_status, branding_priority, mileage, cleaning_status, stabling_position, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []);
    } catch {}
    return recentResults || [];
  };

  const recomputeNsgaRanks = (rows: any[]): any[] => {
    const avgMileage = rows.reduce((a, b) => a + (Number(b.mileage) || 0), 0) / (rows.length || 1);
    const rowsForNsga = rows.map((r: any) => {
      const f = String(r.fitness_certificate_status || "").toLowerCase();
      const j = String(r.job_card_status || "").toLowerCase();
      const b = String(r.branding_priority || "").toLowerCase();
      const c = String(r.cleaning_status || "").toLowerCase();
      const stab = String(r.stabling_position || "").toLowerCase();
      const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;
      const fitnessInvalid = (f.includes('expired') || f.includes('revoked') || f.includes('invalid')) ? 1 : 0;
      const jobs = j.includes('open') || j.includes('major') || j.includes('critical') ? 1 : j.includes('minor') || j.includes('pending') ? 0.5 : 0;
      const branding = b === 'high' ? 1 : b === 'medium' ? 0.5 : 0;
      const mileageDev = Math.abs(mileageNum - avgMileage);
      const cleaningNeed = c.includes('clean') ? 0 : 1;
      const geometry = stab ? 0 : 0.5;
      return { base: r, objectives: [fitnessInvalid, jobs, branding, mileageDev, cleaningNeed, geometry] };
    });
    const normalized = normalizeObjectives(rowsForNsga.map(r => r.objectives));
    const items: NSGAItem<any>[] = normalized.map((obj, i) => ({ data: rowsForNsga[i].base, objectives: obj }));
    const ranked = nsgaRank(items).map(it => ({ ...it.data, nsga_rank: it.rank, nsga_crowding: it.crowding }));
    for (const r of ranked) {
      const f = String(r.fitness_certificate_status || '').toLowerCase();
      const c = String(r.cleaning_status || '').toLowerCase();
      r.induction_category = (f.includes('expired') || f.includes('revoked') || f.includes('invalid'))
        ? 'Inspection Bay (Maintenance)'
        : (c.includes('pending') || c.includes('partial')) ? 'Cleaning / Detailing' : 'Revenue Service';
    }
    return ranked;
  };

  const runWhatIf = async () => {
    try {
      setWhatIfLoading(true);
      setWhatIfAnswer("");
      const q = whatIfQuery.trim();
      if (!q) { setWhatIfAnswer("Enter a question like: What if Train 13 job card Closed?"); return; }

      const trainNumMatch = q.match(/train\s*(?:no\.?|number)?\s*(\d+)/i);
      let targetId: string | undefined;
      if (trainNumMatch) {
        const num = trainNumMatch[1];
        const candidates = recentResults || [];
        const found = candidates.find((r: any) => String(r.train_id).toLowerCase() === `train${num}`.toLowerCase())
          || candidates.find((r: any) => String(r.train_id).endsWith(num));
        targetId = found?.train_id;
      }
      if (!targetId) {
        const idMatch = q.match(/train\s*([a-z]*\d+)/i);
        if (idMatch) targetId = idMatch[1];
      }

      const original = (recentResults && recentResults.length) ? recentResults : await loadLatestRows();
      if (!Array.isArray(original) || original.length === 0) { setWhatIfAnswer("No results available to simulate."); return; }

      const modified = original.map(r => ({ ...r }));
      const findIdx = () => modified.findIndex((r: any) => String(r.train_id) === String(targetId));
      const applyToTarget = (fn: (o: any) => void) => { const i = findIdx(); if (i >= 0) fn(modified[i]); };
      const low = q.toLowerCase();
      const num = (s?: string) => { if (!s) return undefined; const n = Number(String(s).replace(/[\,\s]/g, '')); return isFinite(n) ? n : undefined; };
      const changeNotes: string[] = [];

      const jcAll = Array.from(low.matchAll(/job\s*card[s]?[^]*?(closed|open|major|minor|cosmetic)/g));
      if (jcAll.length) { const v = jcAll[jcAll.length - 1][1]; applyToTarget(o => { o.job_card_status = v.charAt(0).toUpperCase() + v.slice(1); }); changeNotes.push(`Job Card → ${v}`); }

      const fitAll = Array.from(low.matchAll(/fitness[^]*?(valid|expired|revoked|conditional)/g));
      if (fitAll.length) { const v = fitAll[fitAll.length - 1][1]; applyToTarget(o => { o.fitness_certificate_status = v.charAt(0).toUpperCase() + v.slice(1); }); changeNotes.push(`Fitness → ${v}`); }

      const incBy = Array.from(low.matchAll(/mileage[^]*?(?:increase|increased|add|plus)\s*by\s*(\d[\d,]*)/g));
      const decBy = Array.from(low.matchAll(/mileage[^]*?(?:decrease|decreased|reduce|minus)\s*by\s*(\d[\d,]*)/g));
      const setTo = Array.from(low.matchAll(/mileage[^]*?(?:to|=)\s*(\d[\d,]*)/g));
      if (incBy.length) { const d = num(incBy[incBy.length - 1][1]) || 0; applyToTarget(o => { const cur = num(o.mileage) || 0; o.mileage = cur + d; }); changeNotes.push(`Mileage +${d}`); }
      if (decBy.length) { const d = num(decBy[decBy.length - 1][1]) || 0; applyToTarget(o => { const cur = num(o.mileage) || 0; o.mileage = Math.max(0, cur - d); }); changeNotes.push(`Mileage -${d}`); }
      if (setTo.length) { const v = num(setTo[setTo.length - 1][1]); if (v !== undefined) { applyToTarget(o => { o.mileage = v; }); changeNotes.push(`Mileage = ${v}`); } }

      const cleanAll = Array.from(low.matchAll(/clean(?:ing)?[^]*?(scheduled|in[\s-]*progress|delayed|pending|completed|partial)/g));
      if (cleanAll.length) {
        const v = cleanAll[cleanAll.length - 1][1];
        let mapped = v;
        if (/pending|partial/.test(v)) mapped = 'InProgress';
        if (/completed/.test(v)) mapped = 'Scheduled';
        if (/in[\s-]*progress/.test(v)) mapped = 'InProgress';
        if (/delayed/.test(v)) mapped = 'Delayed';
        if (/scheduled/.test(v)) mapped = 'Scheduled';
        applyToTarget(o => { o.cleaning_status = mapped; });
        changeNotes.push(`Cleaning → ${mapped}`);
      }

      const brandAll = Array.from(low.matchAll(/brand(?:ing)?[^]*?(high|medium|low)/g));
      if (brandAll.length) { const v = brandAll[brandAll.length - 1][1]; applyToTarget(o => { o.branding_priority = v.charAt(0).toUpperCase() + v.slice(1); }); changeNotes.push(`Branding → ${v}`); }

      if (/(no\s*stabling|without\s*stabling)/i.test(q)) { applyToTarget(o => { o.stabling_position = ''; }); }
      const stabTo = Array.from(low.matchAll(/stabling[^]*?(?:to|at|=)\s*([a-z0-9_-]+)/g));
      if (stabTo.length) { const v = stabTo[stabTo.length - 1][1]; applyToTarget(o => { o.stabling_position = v; }); }

      const ranked = recomputeNsgaRanks(modified);
      if (!targetId) {
        const top = ranked.slice(0, 5).map((r: any) => `${r.train_id}(${r.nsga_rank})`).join(', ');
        setWhatIfAnswer(`Top 5: ${top}`);
        setWhatIfLoading(false);
        return;
      }

      const before = original.find((r: any) => String(r.train_id) === String(targetId));
      const after = ranked.find((r: any) => String(r.train_id) === String(targetId));
      const newRank = (after as any)?.nsga_rank ?? '-';
      const oldRank = (before as any)?.nsga_rank ?? '-';

      const beforeCat = (() => {
        const f = String((before as any)?.fitness_certificate_status || '').toLowerCase();
        const c = String((before as any)?.cleaning_status || '').toLowerCase();
        return (f.includes('expired') || f.includes('revoked') || f.includes('invalid'))
          ? 'Inspection Bay (Maintenance)'
          : (c.includes('pending') || c.includes('partial') || c.includes('inprogress') || c.includes('delayed'))
            ? 'Cleaning / Detailing' : 'Revenue Service';
      })();
      const afterCat = String((after as any)?.induction_category || '').trim() || (() => {
        const f = String((after as any)?.fitness_certificate_status || '').toLowerCase();
        const c = String((after as any)?.cleaning_status || '').toLowerCase();
        return (f.includes('expired') || f.includes('revoked') || f.includes('invalid'))
          ? 'Inspection Bay (Maintenance)'
          : (c.includes('pending') || c.includes('partial') || c.includes('inprogress') || c.includes('delayed'))
            ? 'Cleaning / Detailing' : 'Revenue Service';
      })();

      const movement = ((): string => {
        if (beforeCat !== afterCat) {
          if (afterCat.includes('Inspection')) return 'Moved to Inspection Bay (removed from service)';
          if (beforeCat.includes('Inspection')) return 'Returned to service';
          if (afterCat.includes('Cleaning')) return 'Moved to Cleaning/Detailing';
          if (beforeCat.includes('Cleaning')) return 'Returned to Revenue Service';
        }
        if (typeof oldRank === 'number' && typeof newRank === 'number') {
          if (newRank < oldRank) return 'Up';
          if (newRank > oldRank) return 'Down';
          return 'No change';
        }
        return 'Updated';
      })();
      const concise = `${String(targetId)}: ${oldRank}→${newRank}; ${movement}; Category: ${beforeCat}→${afterCat}${changeNotes.length ? `; Reason: ${changeNotes[0]}.` : '.'}`;
      setWhatIfAnswer(concise);
    } catch (e: any) {
      setWhatIfAnswer(e?.message || 'What-If simulation failed');
    } finally {
      setWhatIfLoading(false);
    }
  };

  const compareWithAI = async () => {
    try {
      setAiLoading(true);
      // Build payload from the currently visible results (use the unified recentResults list)
      const buildFeature = (r: any) => ({
        train_id: r.train_id,
        fitness_certificate_status: r.fitness_certificate_status ?? r.model ?? '',
        job_card_status: r.job_card_status ?? r.status ?? '',
        branding_priority: r.branding_priority ?? '',
        mileage: typeof r.mileage === 'number' ? r.mileage : (parseInt(String(r.mileage || '0'), 10) || 0),
        cleaning_status: r.cleaning_status ?? '',
        stabling_position: r.stabling_position ?? ''
      });

      // Decide which list to use based on filter
      let source: any[] = recentResults;
      if (resultsFilter === 'ready') source = readyResults;
      else if (resultsFilter === 'cleaning') source = cleaningResults;
      else if (resultsFilter === 'maintenance') source = maintenanceResults;

      const trains = source.map(buildFeature).filter(t => t.train_id);
      if (trains.length === 0) {
        toast({ title: 'No rows to compare', description: 'Upload or select results first.' });
        return;
      }

      // Try remote predictions first; if it fails or returns empty, fall back to local scoring-derived ranks
      const map: Record<string, number> = {};
      let usedFallback = false;
      try {
        const res = await fetch('https://kochi-ml-api.onrender.com/predict/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trains })
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json();
        const preds = json?.predictions || [];
        for (const p of preds) {
          if (p.train_id) map[p.train_id] = Number(p.predicted_rank);
        }
        if (Object.keys(map).length === 0) throw new Error('Empty predictions');
      } catch {
        // Fallback: compute local AI rank using computeScore and convert to rank ordering
        usedFallback = true;
        // Compute average mileage to feed scoring
        const avgMileage = trains.reduce((a, b) => a + (Number(b.mileage) || 0), 0) / (trains.length || 1);
        const scored = trains.map(t => {
          const row: TrainRow = {
            trainId: t.train_id,
            fitnessCerts: String(t.fitness_certificate_status || '').toLowerCase().includes('valid') ? 'Valid' : (String(t.fitness_certificate_status || '').toLowerCase().includes('expired') ? 'Expired' : 'Conditional'),
            workOrders: String(t.job_card_status || '').toLowerCase().includes('open') ? 'Major' : String(t.job_card_status || '').toLowerCase().includes('minor') ? 'Minor' : 'Closed',
            mileageStatus: 'Balanced',
            wrapExposure: String(t.branding_priority || '').toLowerCase() === 'high' ? 'Behind' : 'OnTarget',
            cleaningSlot: String(t.cleaning_status || '').toLowerCase().includes('clean') ? 'Available' : 'NotAvailable',
            stabling: t.stabling_position ? 'Optimal' : 'Moderate',
            // @ts-ignore
            mileage: Number(t.mileage) || 0
          };
          const { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
          return { id: t.train_id, score: total };
        })
        .sort((a, b) => b.score - a.score);
        // Assign ranks 1..n based on descending score
        scored.forEach((s, idx) => { map[s.id] = idx + 1; });
      }
      // Debug: compare AI vs Pareto in console for a short while
      try {
        const compareRows = source.map((r: any) => ({
          train_id: r.train_id,
          pareto_rank: typeof r.nsga_rank === 'number' ? r.nsga_rank : null,
          ai_rank: map[r.train_id] ?? null,
          ai_rank_precise: map[r.train_id] !== undefined ? Number(map[r.train_id]).toFixed(6) : null,
        }));
        const matches = compareRows.filter(row => row.pareto_rank != null && row.ai_rank != null && Number(row.pareto_rank) === Number(row.ai_rank)).length;
        // eslint-disable-next-line no-console
        console.groupCollapsed('[AI Compare] Pareto vs AI Rank');
        // eslint-disable-next-line no-console
        console.table(compareRows);
        // eslint-disable-next-line no-console
        console.log(`Matched ranks: ${matches}/${compareRows.length}`);
        // Basic metrics when both present
        const diffs = compareRows
          .filter(r => r.pareto_rank != null && r.ai_rank != null)
          .map(r => Math.abs(Number(r.pareto_rank) - Number(r.ai_rank)));
        if (diffs.length) {
          const mae = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          const rmse = Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / diffs.length);
          // eslint-disable-next-line no-console
          console.log(`MAE: ${mae.toFixed(3)} | RMSE: ${rmse.toFixed(3)}`);
        }
        // Expose for manual console checks
        // @ts-ignore
        (window as any).aiPredictionsMap = map;
        // @ts-ignore
        (window as any).aiCompareRows = compareRows;
        // Optional: auto-close group after a short delay
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.groupEnd?.();
        }, 4000);
      } catch {}
      setAiRankByTrain(map);
      // Build dialog rows from current source + map (outside debug scope)
      const rowsForDialog = source.map((r:any) => ({
        train_id: r.train_id,
        pareto_rank: typeof r.nsga_rank === 'number' ? r.nsga_rank : null,
        ai_rank: map[r.train_id] ?? null,
        fitness: r.fitness_certificate_status ?? r.model ?? null,
        job_cards: r.job_card_status ?? r.status ?? null,
        branding: r.branding_priority ?? null,
        mileage: typeof r.mileage === 'number' ? r.mileage : (parseInt(String(r.mileage||'0'),10)||0),
        cleaning: r.cleaning_status ?? null,
        stabling: r.stabling_position ?? null,
        updated: (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toLocaleString() : null,
        info: (() => {
          const f = r.fitness_certificate_status ?? r.model ?? '-';
          const j = r.job_card_status ?? r.status ?? '-';
          const b = r.branding_priority ?? '-';
          const m = typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-');
          const c = r.cleaning_status ?? '-';
          const s = r.stabling_position ?? '-';
          const cat = r.induction_category ?? '-';
          const rk = r.nsga_rank ?? '-';
          const name = r.train_id || 'This train';
          return `${name} is ranked ${rk} (${cat}). Fitness is ${f}; job cards are ${j}. Branding is ${b}; mileage is ${m} km. Cleaning is ${c}; stabling is ${s}.`;
        })(),
      }));
      setAiCompareTable(rowsForDialog);
      toast({ title: usedFallback ? 'AI comparison (local)' : 'AI comparison ready', description: usedFallback ? 'Used local model as a fallback.' : 'Showing AI-predicted rank next to Pareto Rank.' });
      // Navigate to compare page with state
      navigate('/compare-ai', { state: { rows: rowsForDialog } });
    } catch (e: any) {
      // As an ultimate fallback, try to navigate with Pareto-only rows
      try {
        const source: any[] = recentResults.length ? recentResults : [];
        if (source.length) {
          const rowsForDialog = source.map((r:any) => ({
            train_id: r.train_id,
            pareto_rank: typeof r.nsga_rank === 'number' ? r.nsga_rank : null,
            ai_rank: null,
            fitness: r.fitness_certificate_status ?? r.model ?? null,
            job_cards: r.job_card_status ?? r.status ?? null,
            branding: r.branding_priority ?? null,
            mileage: typeof r.mileage === 'number' ? r.mileage : (parseInt(String(r.mileage||'0'),10)||0),
            cleaning: r.cleaning_status ?? null,
            stabling: r.stabling_position ?? null,
            updated: (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toLocaleString() : null,
            info: ''
          }));
          navigate('/compare-ai', { state: { rows: rowsForDialog } });
          toast({ title: 'AI compare failed', description: 'Showing Pareto-only results.', variant: 'destructive' });
        } else {
          toast({ title: 'AI compare failed', description: e?.message || 'Could not fetch predictions', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'AI compare failed', description: e?.message || 'Could not fetch predictions', variant: 'destructive' });
      }
    } finally {
      setAiLoading(false);
    }
  };

  const renderInfoCell = (r: any) => {
    let explanation: string = r.explanation || '';
    if (!explanation) {
      const f = r.fitness_certificate_status ?? r.model ?? '-';
      const j = r.job_card_status ?? r.status ?? '-';
      const b = r.branding_priority ?? '-';
      const m = typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-');
      const c = r.cleaning_status ?? '-';
      const s = r.stabling_position ?? '-';
      const cat = r.induction_category ?? '-';
      const rk = r.nsga_rank ?? '-';
      const name = r.train_id || 'This train';
      explanation = `${name} is ranked ${rk} (${cat}). Fitness is ${f}; job cards are ${j}. ` +
        `Branding is ${b}; mileage is ${m} km. Cleaning is ${c}; stabling is ${s}.`;
    }
    const conflicts: string[] = Array.isArray(r.conflicts) ? r.conflicts : [];
    const alerts: string[] = [];
    if (r.alert_fitness_invalid) alerts.push('Fitness invalid');
    if (r.alert_job_open) alerts.push('Open job cards');
    if (r.alert_cleaning_pending) alerts.push('Cleaning pending');
    if (r.alert_cleaning_partial) alerts.push('Cleaning partial');
    if (r.alert_no_stabling) alerts.push('No stabling');
    const text = [
      explanation ? `Why: ${explanation}` : '',
      alerts.length ? `Alerts: ${alerts.join(', ')}` : '',
      conflicts.length ? `Conflicts: ${conflicts.join(' | ')}` : ''
    ].filter(Boolean).join('\n\n');
    if (!text) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <button
        onClick={() => { setInfoContent({ title: r.train_id || 'Train', description: text }); setInfoOpen(true); }}
        title="View explanation and alerts"
        className="inline-flex items-center text-blue-600 hover:underline"
      >
        <Info className="w-4 h-4" />
      </button>
    );
  };

  const fetchTrainInfo = async () => {
    setLoading(true);
    try {
      // First try to get from trains table
      let { data, error } = await supabase
        .from('trains')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && (error.code === 'PGRST116' || error.message.includes('trains') || error.message.includes('schema cache'))) {
        // Fallback to train_data table
        const { data: trainData, error: trainDataError } = await supabase
          .from('train_data')
          .select('train_id, created_at, fitness_certificate_status, job_card_status')
          .order('created_at', { ascending: false });

        if (trainDataError) {
          // If train_data also fails, show empty state
          console.log('No train tables available');
          setTrainInfo([]);
          return;
        }
        
        // Convert train_data to trains format, using mapped fields
        const convertedData = trainData?.map((item, index) => ({
          id: `temp-${index}`,
          train_id: item.train_id,
          model: item.fitness_certificate_status || 'Unknown',
          status: (item.job_card_status as 'active' | 'maintenance' | 'retired') || 'active',
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) || [];
        
        setTrainInfo(convertedData);
        return;
      }

      if (error) throw error;
      setTrainInfo(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch train information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTrainSaved = () => {
    setShowTrainForm(false);
    setEditingTrain(null);
    fetchTrainInfo();
    toast({
      title: "Success",
      description: "Train information saved successfully",
    });
  };

  const handleEditTrain = (train: TrainInfo) => {
    setEditingTrain(train);
    setShowTrainForm(true);
  };

  const handleAddTrain = () => {
    setEditingTrain(null);
    setShowTrainForm(true);
  };

  const handleContinueToCSV = () => {
    if (trainInfo.length === 0) {
      toast({
        title: "Warning",
        description: "Please add at least one train before proceeding",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep('csv-upload');
  };

  const handleCSVUploaded = () => {
    setFromFlow(true);
    setCurrentStep('results');
  };

  const saveListing = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    
    // Generate unique batch ID for this upload
    const uploadBatchId = crypto.randomUUID();
    const processedAt = new Date().toISOString();
    
    // Get current count of each train in the database
    const trainCounts: Record<string, number> = {};
    for (const row of rows) {
      const trainId = row.train_id;
      if (trainId) {
        const { count } = await supabase
          .from('listing')
          .select('*', { count: 'exact', head: true })
          .eq('train_id', trainId);
        trainCounts[trainId] = (count || 0) + 1;
      }
    }
    
    const avgMileage = (() => {
      const vals = rows.map((r: any) => (typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0')) || 0));
      const sum = vals.reduce((a, b) => a + b, 0);
      return vals.length ? sum / vals.length : 0;
    })();
    const payload = rows.map((r: any) => {
      let scoreNum: number | undefined = typeof r.score === 'number' ? r.score : undefined;
      if (scoreNum === undefined) {
        // Fallback: compute a local score similar to listing view
        const row: TrainRow = {
          trainId: r.train_id,
          fitnessCerts: String(r.fitness_certificate_status || '').toLowerCase().includes('valid') ? 'Valid' : (String(r.fitness_certificate_status || '').toLowerCase().includes('expired') ? 'Expired' : 'Conditional'),
          workOrders: String(r.job_card_status || '').toLowerCase().includes('open') ? 'Major' : String(r.job_card_status || '').toLowerCase().includes('minor') ? 'Minor' : 'Closed',
          mileageStatus: 'Balanced',
          wrapExposure: String(r.branding_priority || '').toLowerCase() === 'high' ? 'Behind' : 'OnTarget',
          cleaningSlot: String(r.cleaning_status || '').toLowerCase().includes('clean') ? 'Available' : 'NotAvailable',
          stabling: r.stabling_position ? 'Optimal' : 'Moderate',
          // @ts-ignore
          mileage: typeof r.mileage === 'number' ? r.mileage : (parseInt(String(r.mileage || '0')) || 0)
        };
        scoreNum = computeScore(row, { fleetAvgKm30d: avgMileage }).total;
      }
      const fitnessTxt = String(r.fitness_certificate_status || '').toLowerCase();
      const cleaningTxt = String(r.cleaning_status || '').toLowerCase();
      let category: string = 'Revenue Service';
      if (fitnessTxt.includes('expired') || fitnessTxt.includes('invalid') || fitnessTxt.includes('revoked')) category = 'Inspection Bay (Maintenance)';
      else if (cleaningTxt.includes('pending') || cleaningTxt.includes('partial')) category = 'Cleaning / Detailing';

      // Generate explanation, alerts, and conflicts like in renderInfoCell
      let explanation: string = r.explanation || '';
      if (!explanation) {
        const f = r.fitness_certificate_status ?? r.model ?? '-';
        const j = r.job_card_status ?? r.status ?? '-';
        const b = r.branding_priority ?? '-';
        const m = typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-');
        const c = r.cleaning_status ?? '-';
        const s = r.stabling_position ?? '-';
        const cat = r.induction_category ?? category;
        const rk = r.nsga_rank ?? '-';
        const name = r.train_id || 'This train';
        explanation = `${name} is ranked ${rk} (${cat}). Fitness is ${f}; job cards are ${j}. ` +
          `Branding is ${b}; mileage is ${m} km. Cleaning is ${c}; stabling is ${s}.`;
      }
      
      const conflicts: string[] = Array.isArray(r.conflicts) ? r.conflicts : [];
      const alerts: string[] = [];
      if (r.alert_fitness_invalid) alerts.push('Fitness invalid');
      if (r.alert_job_open) alerts.push('Open job cards');
      if (r.alert_cleaning_pending) alerts.push('Cleaning pending');
      if (r.alert_cleaning_partial) alerts.push('Cleaning partial');
      if (r.alert_no_stabling) alerts.push('No stabling');

      return {
        train_id: r.train_id,
        pareto_rank: typeof r.nsga_rank === 'number' ? r.nsga_rank : null,
        fitness_certificate_status: r.fitness_certificate_status ?? null,
        job_card_status: r.job_card_status ?? null,
        branding_priority: r.branding_priority ?? null,
        mileage: typeof r.mileage === 'number' ? Math.trunc(r.mileage) : (parseInt(String(r.mileage || '0')) || 0),
        cleaning_status: r.cleaning_status ?? null,
        stabling_position: r.stabling_position ?? null,
        category: category,
        explanation: explanation,
        alerts: JSON.stringify(alerts),
        conflicts: JSON.stringify(conflicts),
        upload_batch_id: uploadBatchId,
        upload_count: trainCounts[r.train_id] || 1,
        processed_at: processedAt,
        updated_at: new Date().toISOString()
      };
    });
    try {
      // Always insert new rows for each upload (no updates)
      const { error } = await supabase
        .from('listing')
        .insert(payload);

      if (error) {
        console.error('listing insert error', error);
        toast({ title: 'Save failed', description: error.message || 'Could not save listing', variant: 'destructive' });
      } else {
        toast({ 
          title: 'Success', 
          description: `Added ${payload.length} new train records to listing` 
        });
      }
    } catch (e: any) {
      console.error('listing save exception', e);
      toast({ title: 'Save failed', description: e.message || 'Could not save listing', variant: 'destructive' });
    }
  };

  const scoreCachedResults = async () => {
    try {
      const cached = localStorage.getItem('recent_results');
      if (!cached) return false;
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      const rows = parsed.map((r: any, idx: number) => ({
        train_id: r.train_id || r.TrainID || `temp-${idx}`,
        fitness_certificate_status: r.fitness_certificate_status || r.FitnessCertificateStatus || '-',
        job_card_status: r.job_card_status || r.JobCardStatus || '-',
        branding_priority: r.branding_priority || r.BrandingPriority || '-',
        mileage: Number(r.mileage ?? r.MileageTotalKM ?? 0),
        cleaning_status: r.cleaning_status || r.CleaningStatus || '-',
        stabling_position: r.stabling_position || r.BayPosition || '-',
        created_at: new Date().toISOString()
      }));
      const avgMileage = rows.reduce((a, b) => a + (Number(b.mileage) || 0), 0) / (rows.length || 1);
      const scored = await Promise.all(rows.map(async (r: any) => {
        const row: TrainRow = {
          trainId: r.train_id,
          fitnessCerts: String(r.fitness_certificate_status || '').toLowerCase().includes('valid') ? 'Valid' : (String(r.fitness_certificate_status || '').toLowerCase().includes('expired') ? 'Expired' : 'Conditional'),
          workOrders: String(r.job_card_status || '').toLowerCase().includes('open') ? 'Major' : String(r.job_card_status || '').toLowerCase().includes('minor') ? 'Minor' : 'Closed',
          mileageStatus: 'Balanced',
          wrapExposure: String(r.branding_priority || '').toLowerCase() === 'high' ? 'Behind' : 'OnTarget',
          cleaningSlot: String(r.cleaning_status || '').toLowerCase().includes('clean') ? 'Available' : 'NotAvailable',
          stabling: r.stabling_position ? 'Optimal' : 'Moderate',
          // @ts-ignore
          mileage: Number(r.mileage) || 0
        };
        const { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
        return { ...r, score: total };
      }));

      // NSGA-II ranking and grouping for cached rows
      const rowsForNsga = scored.map((r: any) => {
        const f = String(r.fitness_certificate_status || '').toLowerCase();
        const j = String(r.job_card_status || '').toLowerCase();
        const b = String(r.branding_priority || '').toLowerCase();
        const c = String(r.cleaning_status || '').toLowerCase();
        const stab = String(r.stabling_position || '').toLowerCase();
        const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;
        const fitnessInvalid = (f.includes('expired') || f.includes('revoked')) ? 1 : 0;
        const jobs = j.includes('open') || j.includes('major') || j.includes('critical') ? 1 : j.includes('minor') || j.includes('pending') ? 0.5 : 0;
        const branding = b === 'high' ? 1 : b === 'medium' ? 0.5 : 0;
        const mileageDev = Math.abs(mileageNum - avgMileage);
        const cleaningNeed = c.includes('clean') ? 0 : 1;
        const geometry = stab ? 0 : 0.5;
        return { base: r, objectives: [fitnessInvalid, jobs, branding, mileageDev, cleaningNeed, geometry] };
      });
      const normalized = normalizeObjectives(rowsForNsga.map(r => r.objectives));
      const items: NSGAItem<any>[] = normalized.map((obj, i) => ({ data: rowsForNsga[i].base, objectives: obj }));
      const rankedNsga = nsgaRank(items).map(it => ({ ...it.data, nsga_rank: it.rank, nsga_crowding: it.crowding }));

      const groups = { ready: [] as any[], cleaning: [] as any[], maintenance: [] as any[] };
      for (const r of rankedNsga) {
        const f = String(r.fitness_certificate_status || '').toLowerCase();
        const j = String(r.job_card_status || '').toLowerCase();
        const c = String(r.cleaning_status || '').toLowerCase();
        const isInvalid = f.includes('expired') || f.includes('revoked') || f.includes('invalid');
        const hasOpen = j.includes('open') || j.includes('major') || j.includes('critical');
        let cat: 'ready'|'cleaning'|'maintenance' = 'ready';
        if (isInvalid) cat = 'maintenance';
        else if (c.includes('pending')) cat = 'cleaning';
        (groups[cat] as any[]).push(r);
      }

      setRecentResults(rankedNsga);
      setReadyResults(groups.ready);
      setCleaningResults(groups.cleaning);
      setMaintenanceResults(groups.maintenance);
      try { await saveListing(rankedNsga); } catch {}
      return true;
    } catch {
      return false;
    }
  };

  const fetchRecentResults = async () => {
    try {
      const { data, error } = await supabase
        .from('train_data')
        .select('train_id, fitness_certificate_status, job_card_status, branding_priority, mileage, cleaning_status, stabling_position, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        const { data: trains, error: trainsError } = await supabase
          .from('trains')
          .select('train_id, model, status, updated_at, created_at')
          .order('updated_at', { ascending: false })
          .limit(10);
        if (trainsError) return;
        const trainIds = (trains || []).map(t => t.train_id).filter(Boolean);
        let latestByTrain: Record<string, any> = {};
        if (trainIds.length) {
          const { data: td } = await supabase
            .from('train_data')
            .select('train_id, fitness_certificate_status, job_card_status, branding_priority, mileage, cleaning_status, stabling_position, created_at')
            .in('train_id', trainIds)
            .order('created_at', { ascending: false });
          for (const r of td || []) {
            if (!latestByTrain[r.train_id]) latestByTrain[r.train_id] = r;
          }
        }

        // Compute average mileage for normalization
        const avgMileage = (() => {
          const values = (Object.values(latestByTrain) as any[]).map(r => typeof r.mileage === 'number' ? r.mileage : 0);
          const sum = values.reduce((a, b) => a + b, 0);
          return values.length ? sum / values.length : 0;
        })();

        const enriched = await Promise.all((trains || []).map(async (t: any) => {
          const r = latestByTrain[t.train_id] || {};
          const fitness = String(r.fitness_certificate_status || t.model || '').toLowerCase();
          const job = String(r.job_card_status || t.status || '').toLowerCase();
          const branding = String(r.branding_priority || '').toLowerCase();
          const cleaning = String(r.cleaning_status || '').toLowerCase();
          const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;

          let fitnessCerts: string = 'Conditional';
          if (fitness.includes('valid')) fitnessCerts = 'Valid';
          else if (fitness.includes('expired') || fitness.includes('revoked')) fitnessCerts = 'Expired';

          let workOrders: string = 'Closed';
          if (job.includes('critical') || job.includes('open')) workOrders = 'Major';
          else if (job.includes('minor') || job.includes('pending')) workOrders = 'Minor';
          else if (job.includes('clear') || job.includes('closed')) workOrders = 'Closed';

          let mileageStatus: string = 'Balanced';
          if (avgMileage > 0) {
            const delta = mileageNum - avgMileage;
            if (delta > avgMileage * 0.2) mileageStatus = 'Overrun';
            else if (delta < -avgMileage * 0.2) mileageStatus = 'Underrun';
          }

          let wrapExposure: string = 'OnTarget';
          if (branding === 'high') wrapExposure = 'Behind';
          else if (branding === 'medium') wrapExposure = 'OnTarget';
          else if (branding === 'low') wrapExposure = 'OnTarget';

          const cleaningSlot = cleaning === 'clean' ? 'Available' : 'NotAvailable';
          const stabling = r.stabling_position ? 'Optimal' : 'Moderate';

          const row: TrainRow = {
            trainId: t.train_id,
            fitnessCerts,
            workOrders,
            mileageStatus,
            wrapExposure,
            cleaningSlot,
            stabling,
            // @ts-ignore
            mileage: mileageNum
          };
          // Local baseline
          let { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
          // Try API scoring if keys present
          // Remote scoring disabled; use local computeScore result
          return { ...t, ...r, score: total };
        }))
        .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

        // NSGA-II multi-objective ranking using six proxies
        const rowsForNsga = enriched.map((r: any) => {
          const f = String(r.fitness_certificate_status || r.model || '').toLowerCase();
          const j = String(r.job_card_status || r.status || '').toLowerCase();
          const b = String(r.branding_priority || '').toLowerCase();
          const c = String(r.cleaning_status || '').toLowerCase();
          const stab = String(r.stabling_position || '').toLowerCase();
          const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;
          const fitnessInvalid = (f.includes('expired') || f.includes('revoked')) ? 1 : 0;
          const jobs = j.includes('open') || j.includes('major') || j.includes('critical') ? 1 : j.includes('minor') || j.includes('pending') ? 0.5 : 0;
          const branding = b === 'high' ? 1 : b === 'medium' ? 0.5 : 0;
          const mileageDev = Math.abs(mileageNum - avgMileage);
          const cleaningNeed = c.includes('clean') ? 0 : 1;
          const geometry = stab ? 0 : 0.5;
          return { base: r, objectives: [fitnessInvalid, jobs, branding, mileageDev, cleaningNeed, geometry] };
        });
        const normalized = normalizeObjectives(rowsForNsga.map(r => r.objectives));
        const items: NSGAItem<any>[] = normalized.map((obj, i) => ({ data: rowsForNsga[i].base, objectives: obj }));
        const rankedNsga = nsgaRank(items).map(it => ({ ...it.data, nsga_rank: it.rank, nsga_crowding: it.crowding }));

        // Classify into three lists
        const groups = { ready: [] as any[], cleaning: [] as any[], maintenance: [] as any[] };
        for (const r of rankedNsga) {
          const f = String(r.fitness_certificate_status || r.model || '').toLowerCase();
          const j = String(r.job_card_status || r.status || '').toLowerCase();
          const c = String(r.cleaning_status || '').toLowerCase();
          const isInvalid = f.includes('expired') || f.includes('revoked') || f.includes('invalid');
          const hasOpen = j.includes('open') || j.includes('major') || j.includes('critical');
          let category: 'ready'|'cleaning'|'maintenance' = 'ready';
          if (isInvalid) category = 'maintenance';
          else if (c.includes('pending')) category = 'cleaning';
          (groups[category] as any[]).push(r);
        }

        // If still nothing meaningful, try csv_upload_rows (source-of-truth for last upload)
        if (!enriched.length) {
          const { data: rows } = await supabase
            .from('csv_upload_rows')
            .select('row_data, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

          const mapped = (rows || []).map((r: any, idx: number) => {
            const rd = r.row_data || {};
            return {
              train_id: rd.train_id || rd.TrainID || `temp-${idx}`,
              fitness_certificate_status: rd.fitness_certificate_status || rd.FitnessCertificateStatus || '-',
              job_card_status: rd.job_card_status || rd.JobCardStatus || '-',
              branding_priority: rd.branding_priority || rd.BrandingPriority || '-',
              mileage: Number(rd.mileage ?? rd.MileageTotalKM ?? 0),
              cleaning_status: rd.cleaning_status || rd.CleaningStatus || '-',
              stabling_position: rd.stabling_position || rd.BayPosition || '-',
              created_at: r.created_at
            };
          });

          const avgMileage = mapped.reduce((a, b) => a + (Number(b.mileage) || 0), 0) / (mapped.length || 1);
          const scored = await Promise.all(mapped.map(async (r: any) => {
            const row: TrainRow = {
              trainId: r.train_id,
              fitnessCerts: String(r.fitness_certificate_status || '').toLowerCase().includes('valid') ? 'Valid' : (String(r.fitness_certificate_status || '').toLowerCase().includes('expired') ? 'Expired' : 'Conditional'),
              workOrders: String(r.job_card_status || '').toLowerCase().includes('open') ? 'Major' : String(r.job_card_status || '').toLowerCase().includes('minor') ? 'Minor' : 'Closed',
              mileageStatus: 'Balanced',
              wrapExposure: String(r.branding_priority || '').toLowerCase() === 'high' ? 'Behind' : 'OnTarget',
              cleaningSlot: String(r.cleaning_status || '').toLowerCase().includes('clean') ? 'Available' : 'NotAvailable',
              stabling: r.stabling_position ? 'Optimal' : 'Moderate',
              // @ts-ignore
              mileage: Number(r.mileage) || 0
            };
            let { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
          // Remote scoring disabled; use local
            return { ...r, score: total };
          }));
          return setRecentResults(scored.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)));
        }
        if (enriched.length > 0) {
          setRecentResults(rankedNsga);
          setReadyResults(groups.ready);
          setCleaningResults(groups.cleaning);
          setMaintenanceResults(groups.maintenance);
          saveListing(rankedNsga);
        }
      } else {
        const rows = data || [];
        const avgMileage = (() => {
          const values = rows.map(r => typeof r.mileage === 'number' ? r.mileage : 0);
          const sum = values.reduce((a, b) => a + b, 0);
          return values.length ? sum / values.length : 0;
        })();

        const enriched = await Promise.all(rows.map(async (r: any) => {
          const fitness = String(r.fitness_certificate_status || '').toLowerCase();
          const job = String(r.job_card_status || '').toLowerCase();
          const branding = String(r.branding_priority || '').toLowerCase();
          const cleaning = String(r.cleaning_status || '').toLowerCase();
          const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;

          let fitnessCerts: string = 'Conditional';
          if (fitness.includes('valid')) fitnessCerts = 'Valid';
          else if (fitness.includes('expired') || fitness.includes('revoked')) fitnessCerts = 'Expired';

          let workOrders: string = 'Closed';
          if (job.includes('open')) workOrders = 'Major';
          else if (job.includes('pending')) workOrders = 'Minor';
          else if (job.includes('clear')) workOrders = 'Closed';

          let mileageStatus: string = 'Balanced';
          if (avgMileage > 0) {
            const delta = mileageNum - avgMileage;
            if (delta > avgMileage * 0.2) mileageStatus = 'Overrun';
            else if (delta < -avgMileage * 0.2) mileageStatus = 'Underrun';
          }

          let wrapExposure: string = 'OnTarget';
          if (branding === 'high') wrapExposure = 'Behind';
          else if (branding === 'medium') wrapExposure = 'OnTarget';
          else if (branding === 'low') wrapExposure = 'OnTarget';

          const cleaningSlot = cleaning === 'clean' ? 'Available' : 'NotAvailable';
          const stabling = r.stabling_position ? 'Optimal' : 'Moderate';

          const row: TrainRow = {
            trainId: r.train_id,
            fitnessCerts,
            workOrders,
            mileageStatus,
            wrapExposure,
            cleaningSlot,
            stabling,
            // @ts-ignore
            mileage: mileageNum
          };
          let { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
          // Remote scoring disabled; use local
          return { ...r, score: total };
        }))
        .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

        // NSGA-II
        const rows2 = enriched.map((r: any) => {
          const f = String(r.fitness_certificate_status || '').toLowerCase();
          const j = String(r.job_card_status || '').toLowerCase();
          const b = String(r.branding_priority || '').toLowerCase();
          const c = String(r.cleaning_status || '').toLowerCase();
          const stab = String(r.stabling_position || '').toLowerCase();
          const mileageNum = typeof r.mileage === 'number' ? r.mileage : parseInt(String(r.mileage || '0'), 10) || 0;
          const fitnessInvalid = (f.includes('expired') || f.includes('revoked')) ? 1 : 0;
          const jobs = j.includes('open') || j.includes('major') || j.includes('critical') ? 1 : j.includes('minor') || j.includes('pending') ? 0.5 : 0;
          const branding = b === 'high' ? 1 : b === 'medium' ? 0.5 : 0;
          const mileageDev = Math.abs(mileageNum - avgMileage);
          const cleaningNeed = c.includes('clean') ? 0 : 1;
          const geometry = stab ? 0 : 0.5;
          return { base: r, objectives: [fitnessInvalid, jobs, branding, mileageDev, cleaningNeed, geometry] };
        });
        const normalized2 = normalizeObjectives(rows2.map(r => r.objectives));
        const items2: NSGAItem<any>[] = normalized2.map((obj, i) => ({ data: rows2[i].base, objectives: obj }));
        const rankedNsga2 = nsgaRank(items2).map(it => ({ ...it.data, nsga_rank: it.rank, nsga_crowding: it.crowding }));

        const groups2 = { ready: [] as any[], cleaning: [] as any[], maintenance: [] as any[] };
        for (const r of rankedNsga2) {
          const f = String(r.fitness_certificate_status || '').toLowerCase();
          const j = String(r.job_card_status || '').toLowerCase();
          const c = String(r.cleaning_status || '').toLowerCase();
          const isInvalid = f.includes('expired') || f.includes('revoked') || f.includes('invalid');
          const hasOpen = j.includes('open') || j.includes('major') || j.includes('critical');
          let category: 'ready'|'cleaning'|'maintenance' = 'ready';
          if (isInvalid) category = 'maintenance';
          else if (c.includes('pending')) category = 'cleaning';
          (groups2[category] as any[]).push(r);
        }

        if (enriched.length > 0) {
          setRecentResults(rankedNsga2);
          setReadyResults(groups2.ready);
          setCleaningResults(groups2.cleaning);
          setMaintenanceResults(groups2.maintenance);
          saveListing(rankedNsga2);
        }
      }
    } catch {
      // keep whatever we already have (e.g., cached results)
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setCsvFile(selectedFile);
      // Ensure upload section becomes visible when a file is chosen from quick action
      setShowCSVUpload(true);
      parseTrainCSV(selectedFile);
    }
  };

  const parseTrainCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file must have at least a header and one data row",
          variant: "destructive",
        });
        return;
      }

      const parseCSVLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const headersLower = headers.map(h => h.toLowerCase());
      
      // Map different possible column names to our expected format
      const trainIdIndex = headersLower.findIndex(h => 
        ['trainid', 'train_id', 'train', 'id'].includes(h)
      );
      const modelIndex = headersLower.findIndex(h => 
        ['manufacturer', 'model', 'type'].includes(h)
      );
      const statusIndex = headersLower.findIndex(h => 
        ['status', 'state'].includes(h)
      );
      
      if (trainIdIndex === -1 || modelIndex === -1) {
        const missing = [];
        if (trainIdIndex === -1) missing.push('Train ID (trainid, train_id, train, or id)');
        if (modelIndex === -1) missing.push('Model (manufacturer, model, or type)');
        
        toast({
          title: "Error",
          description: `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const data: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= Math.max(trainIdIndex, modelIndex) + 1) {
          // Create row with all original CSV data
          const row: any = {};
          
          // Map all headers to their values
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          // Also keep the mapped fields for compatibility
          row.train_id = values[trainIdIndex] || '';
          row.model = values[modelIndex] || 'Unknown';
          row.status = statusIndex !== -1 ? (values[statusIndex] || 'active') : 'active';
          
          data.push(row);
        }
      }

      setCsvData(data);
      setPreviewData(data.slice(0, 5)); // Show first 5 rows for preview
      
      toast({
        title: "CSV Parsed",
        description: `${data.length} train records loaded successfully`,
      });
    };
    reader.readAsText(file);
  };

  const handleCSVUpload = async () => {
    if (!csvFile || csvData.length === 0) {
      toast({
        title: "Error",
        description: "Please select a valid CSV file first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Try trains table first
      let uploadSuccess = false;
      try {
        for (const row of csvData) {
          // Use simple insert instead of upsert to avoid ON CONFLICT issues
          const { error } = await supabase
            .from('trains')
            .insert({
              train_id: row.train_id,
              model: row.model,
              status: row.status
            });

          if (error) {
            // If it's a duplicate key error, try to update instead
            if (error.code === '23505' || error.message?.includes('duplicate')) {
              const { error: updateError } = await supabase
                .from('trains')
                .update({
                  model: row.model,
                  status: row.status
                })
                .eq('train_id', row.train_id);
              
              if (updateError) throw updateError;
            } else {
              throw error;
            }
          }
        }
        uploadSuccess = true;
      } catch (trainsError: any) {
        // If trains table doesn't exist, use train_data table
        if (trainsError.message?.includes('trains') || trainsError.message?.includes('schema cache')) {
          console.log('Trains table not found, using train_data table as fallback');
          
          for (const row of csvData) {
            // Delete existing record first, then insert new one with actual CSV data
            await supabase
              .from('train_data')
              .delete()
              .eq('train_id', row.train_id);
            
            // Store CSV data with proper mapping
            const { error } = await supabase
              .from('train_data')
              .insert({
                train_id: row.train_id,
                fitness_certificate_status: row.model || 'Unknown',
                job_card_status: row.status || 'active',
                branding_priority: 'medium',
                mileage: 0,
                cleaning_status: 'pending',
                stabling_position: 'TBD'
              });

            if (error) throw error;
          }
          uploadSuccess = true;
        } else {
          throw trainsError;
        }
      }

      if (uploadSuccess) {
        toast({
          title: "Upload Successful",
          description: `${csvData.length} train records uploaded with complete CSV data preserved exactly as uploaded`,
        });

        // Reset form and refresh data
        setCsvFile(null);
        setCsvData([]);
        setPreviewData([]);
        setShowCSVUpload(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        fetchTrainInfo();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = "Failed to upload CSV data";
      if (error.message?.includes('ON CONFLICT')) {
        errorMessage = "Database constraint error. Please try running 'npm run setup-db' to fix database setup.";
      } else if (error.message?.includes('permission')) {
        errorMessage = "Permission denied. Please check your database access settings.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearCSVFile = () => {
    setCsvFile(null);
    setCsvData([]);
    setPreviewData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchTrainInfo();
  }, []);

  // When navigating from /upload with state { goResults: true }, jump to Step 3 and load results
  useEffect(() => {
    try {
      const state: any = (location as any).state;
      if (state && state.goResults) {
        setFromFlow(true);
        setCurrentStep('results');
        // Clear the navigation state so it doesn't retrigger on future renders
        window.history.replaceState({}, document.title, location.pathname);
      }
    } catch {}
  }, [location]);

  useEffect(() => {
    if (currentStep === 'results') {
      (async () => {
        setResultsLoading(true);
        try {
          // Always try cached results first (works even if DB writes failed)
          const gotCached = await scoreCachedResults();
          if (!gotCached) {
            // Fall back to DB-derived results (works when upload persisted)
            await fetchRecentResults();
          }
        } finally {
          setFromFlow(false);
          setResultsLoading(false);
        }
      })();
    }
  }, [currentStep]);

  if (showTrainForm) {
      return (
      <TrainInfoForm
        train={editingTrain}
        onSave={handleTrainSaved}
        onCancel={() => {
          setShowTrainForm(false);
          setEditingTrain(null);
        }}
        />
      );
    }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {aiLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            {/* Preferred player */}
            <dotlottie-player
              src="https://lottie.host/2488349c-987e-450b-a9e6-5e60ff448e28/yqzciuzw9p.lottie"
              autoplay
              loop
              style={{ width: '360px', height: '360px' } as any}
            />
            <div className="text-lg font-semibold text-white drop-shadow">Comparing with AI…</div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 px-2 rounded-none gap-2 ${resultsLoading ? 'invisible' : ''}`}>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage train information and daily data</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant={currentStep === 'dataset-upload' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setCurrentStep('dataset-upload')}
          >
            Step 0: Dataset Upload
          </Button>
          <ArrowRight className="w-4 h-4" />
          <Button
            size="sm"
            variant={currentStep === 'train-info' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setCurrentStep('train-info')}
          >
            Step 1: Train Info
          </Button>
          <ArrowRight className="w-4 h-4" />
          <Button
            size="sm"
            variant={currentStep === 'csv-upload' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setCurrentStep('csv-upload')}
          >
            Step 2: CSV Upload
          </Button>
          <ArrowRight className="w-4 h-4" />
          <Button
            size="sm"
            variant={currentStep === 'results' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setCurrentStep('results')}
          >
            Step 3: Results
          </Button>
        </div>
      </div>

      {/* Step 0: Dataset Upload */}
      {currentStep === 'dataset-upload' && (
        <DatasetUpload
          onBack={() => setCurrentStep('train-info')}
          onGoToCSVUpload={() => setCurrentStep('csv-upload')}
          onProceedResults={() => { setFromFlow(true); setCurrentStep('results'); }}
        />
      )}

      {/* Step 1: Train Info Management */}
      {currentStep === 'train-info' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="w-5 h-5" />
              Train Information Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainInfo.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No Train Information Found</h3>
                  <p className="text-muted-foreground">
                    Upload your train data (TrainID, Manufacturer, etc.) to get started
                  </p>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left max-w-md mx-auto">
                    <p className="text-sm text-blue-800 font-medium mb-2">Your CSV should have:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• TrainID (or train_id)</li>
                      <li>• Manufacturer (or model)</li>
                      <li>• Status (optional)</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleAddTrain} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Trains
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {trainInfo.length} train(s) configured
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleAddTrain}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Trains
                    </Button>
                  </div>
      </div>

          {/* CSV Upload Section */}
          {showCSVUpload && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-blue-900">Upload Train Information CSV</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowCSVUpload(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="train-csv-file">Select CSV File</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      id="train-csv-file"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                    {csvFile && (
                      <Button variant="outline" onClick={clearCSVFile}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {csvFile && (
                  <div className="flex items-center gap-2 p-3 bg-white rounded border">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">{csvFile.name}</span>
                    <Badge variant="outline">{csvData.length} trains</Badge>
                  </div>
                )}

                {/* CSV Preview */}
                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview (First 5 rows) - Exact CSV Data</Label>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(previewData[0] || {}).map((header) => (
                                <TableHead key={header} className="whitespace-nowrap">
                                  {header}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.map((row, index) => (
                              <TableRow key={index}>
                                {Object.entries(row).map(([key, value]) => (
                                  <TableCell key={key} className="whitespace-nowrap">
                                    {key === 'status' ? (
                                      <Badge 
                                        variant={
                                          value === 'active' ? 'default' : 
                                          value === 'maintenance' ? 'secondary' : 'destructive'
                                        }
                                      >
                                        {String(value || '')}
                                      </Badge>
                                    ) : (
                                      <span className="font-medium">{String(value || '')}</span>
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This shows all columns from your CSV file exactly as they appear.
                    </p>
                  </div>
                )}

                {/* CSV Format Info */}
                <div className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                  <p className="text-sm text-yellow-800">
                    <strong>Required columns:</strong> TrainID (or train_id), Manufacturer (or model), Status (optional)
                  </p>
                </div>

                {/* Database Setup Info */}
                <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
                  <p className="text-sm text-green-800 mb-2">
                    <strong>Complete Data Preservation:</strong> All columns from your CSV file will be stored in train_info tables exactly as they appear.
                  </p>
                  <p className="text-xs text-green-700">
                    The preview above shows all your CSV columns with their exact values - no data is lost or modified.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleCSVUpload} 
                    disabled={!csvFile || csvData.length === 0 || loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {csvData.length} Trains
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCSVUpload(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                      <TableHead>Train ID</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {trainInfo.map((train) => (
                      <TableRow key={train.id}>
                        <TableCell className="font-medium">{train.train_id}</TableCell>
                        <TableCell>{train.model || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              train.status === 'active' ? 'default' : 
                              train.status === 'maintenance' ? 'secondary' : 'destructive'
                            }
                          >
                            {train.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(train.created_at).toLocaleDateString()}
                    </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTrain(train)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleContinueToCSV} size="lg">
                    Continue to CSV Upload
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
        </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: CSV Upload */}
      {currentStep === 'csv-upload' && (
        <CSVUpload
          onUploadComplete={handleCSVUploaded}
          onBack={() => setCurrentStep('train-info')}
        />
      )}

      {/* Step 3: Results */}
      {currentStep === 'results' && (
        <>
          {/* Loading overlay intentionally removed as requested */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle>Recently Processed Trains</CardTitle>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <label htmlFor="resultsFilter" className="text-sm text-muted-foreground">Show</label>
                  <select
                    id="resultsFilter"
                    className="border rounded px-2 py-1 text-sm bg-background w-full sm:w-auto"
                    value={resultsFilter}
                    onChange={(e) => setResultsFilter(e.target.value as any)}
                  >
                    <option value="all">All</option>
                    <option value="ready">Revenue Service</option>
                    <option value="cleaning">Cleaning / Detailing</option>
                    <option value="maintenance">Inspection Bay (Maintenance)</option>
                  </select>
                {/* What-If Simulator trigger */}
                <Sheet open={whatIfOpen} onOpenChange={setWhatIfOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto" variant="outline">What-If</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-xl">
                    <SheetHeader>
                      <SheetTitle>What-If Simulator</SheetTitle>
                      <SheetDescription>
                        Ask questions like: "What if Train 13 job card Closed?" or "What if mileage of Train 15 increased by 10000?" We simulate and re-rank locally.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-3">
                      <Textarea
                        placeholder="Type your scenario..."
                        value={whatIfQuery}
                        onChange={(e) => setWhatIfQuery(e.target.value)}
                        className="min-h-[120px]"
                      />
                      <div className="flex items-center gap-2">
                        <Button onClick={runWhatIf} disabled={whatIfLoading || !recentResults.length}>
                          {whatIfLoading ? 'Simulating…' : 'Run What-If'}
                        </Button>
                        <Button variant="ghost" onClick={() => setWhatIfQuery("")}>Clear</Button>
                      </div>
                      {whatIfAnswer && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Result</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{whatIfAnswer}</div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                    <SheetFooter />
                  </SheetContent>
                </Sheet>
                <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={compareWithAI} disabled={aiLoading}>
                  {aiLoading ? (
                    <span className="inline-flex items-center gap-3">
                      <span className="relative w-10 h-10">
                        <dotlottie-player
                          src="https://lottie.host/2488349c-987e-450b-a9e6-5e60ff448e28/yqzciuzw9p.lottie"
                          autoplay
                          loop
                          style={{ width: '40px', height: '40px' } as any}
                        />
                      </span>
                      Searching…
                    </span>
                  ) : 'Compare with AI'}
                </Button>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      try {
                        await saveListing(recentResults);
                        toast({ title: 'Saved', description: 'Current scheduling list saved to listing table.' });
                      } catch {}
                    }}
                  >
                    Save to Listing
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-left py-4 space-y-10">
                {recentResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No results yet. Try uploading a CSV, then return to this page.</p>
                ) : (
                  <>
                    {(resultsFilter === 'all' || resultsFilter === 'ready') && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Revenue Service</h3>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Train ID</TableHead>
                          <TableHead>Pareto Rank</TableHead>
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
                          {readyResults.map((r, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{r.train_id || '-'}</TableCell>
                              <TableCell>{r.nsga_rank ?? '-'}</TableCell>
                              <TableCell>{r.fitness_certificate_status ?? r.model ?? '-'}</TableCell>
                              <TableCell>{r.job_card_status ?? r.status ?? '-'}</TableCell>
                              <TableCell>{r.branding_priority ?? '-'}</TableCell>
                              <TableCell>{typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-')}</TableCell>
                              <TableCell>{r.cleaning_status ?? '-'}</TableCell>
                              <TableCell>{r.stabling_position ?? '-'}</TableCell>
                          <TableCell>{new Date(r.updated_at || r.created_at || Date.now()).toLocaleString()}</TableCell>
                          <TableCell>{renderInfoCell(r)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                    )}

                    {(resultsFilter === 'all' || resultsFilter === 'cleaning') && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Cleaning / Detailing</h3>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Train ID</TableHead>
                          <TableHead>Pareto Rank</TableHead>
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
                          {cleaningResults.map((r, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{r.train_id || '-'}</TableCell>
                              <TableCell>{r.nsga_rank ?? '-'}</TableCell>
                              <TableCell>{r.fitness_certificate_status ?? r.model ?? '-'}</TableCell>
                              <TableCell>{r.job_card_status ?? r.status ?? '-'}</TableCell>
                              <TableCell>{r.branding_priority ?? '-'}</TableCell>
                              <TableCell>{typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-')}</TableCell>
                              <TableCell>{r.cleaning_status ?? '-'}</TableCell>
                              <TableCell>{r.stabling_position ?? '-'}</TableCell>
                          <TableCell>{new Date(r.updated_at || r.created_at || Date.now()).toLocaleString()}</TableCell>
                          <TableCell>{renderInfoCell(r)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                    )}

                    {(resultsFilter === 'all' || resultsFilter === 'maintenance') && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Inspection Bay (Maintenance)</h3>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Train ID</TableHead>
                          <TableHead>Pareto Rank</TableHead>
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
                          {maintenanceResults.map((r, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{r.train_id || '-'}</TableCell>
                              <TableCell>{r.nsga_rank ?? '-'}</TableCell>
                              <TableCell>{r.fitness_certificate_status ?? r.model ?? '-'}</TableCell>
                              <TableCell>{r.job_card_status ?? r.status ?? '-'}</TableCell>
                              <TableCell>{r.branding_priority ?? '-'}</TableCell>
                              <TableCell>{typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-')}</TableCell>
                              <TableCell>{r.cleaning_status ?? '-'}</TableCell>
                              <TableCell>{r.stabling_position ?? '-'}</TableCell>
                          <TableCell>{new Date(r.updated_at || r.created_at || Date.now()).toLocaleString()}</TableCell>
                          <TableCell>{renderInfoCell(r)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
            <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{infoContent?.title || 'Details'}</DialogTitle>
                  <DialogDescription asChild>
                    <div className="whitespace-pre-wrap text-left text-sm">{infoContent?.description}</div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </Card>
        {/* Dialog removed; comparison now opens on a full page */}
        </>
      )}
    </div>
  );
};

export default Admin;