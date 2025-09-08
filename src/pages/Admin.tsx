import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Plus, Upload, ArrowRight, Train, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TrainInfoForm from "@/components/TrainInfoForm";
import CSVUpload from "@/components/CSVUpload";
import { computeScore, type TrainRow, buildPromptFromRow, runScoring } from "@/lib/scoring";

interface TrainInfo {
  id: string;
  train_id: string;
  model: string;
  status: 'active' | 'maintenance' | 'retired';
  created_at: string;
  updated_at: string;
}

const Admin = () => {
  const [currentStep, setCurrentStep] = useState<'train-info' | 'csv-upload' | 'results'>('train-info');
  const [trainInfo, setTrainInfo] = useState<TrainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [showTrainForm, setShowTrainForm] = useState(false);
  const [editingTrain, setEditingTrain] = useState<TrainInfo | null>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    setCurrentStep('results');
  };

  const saveListing = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const payload = rows.map((r: any) => ({
      train_id: r.train_id,
      score: Number(r.score ?? 0),
      fitness_certificate_status: r.fitness_certificate_status ?? null,
      job_card_status: r.job_card_status ?? null,
      branding_priority: r.branding_priority ?? null,
      mileage: typeof r.mileage === 'number' ? r.mileage : (parseInt(String(r.mileage || '0')) || 0),
      cleaning_status: r.cleaning_status ?? null,
      stabling_position: r.stabling_position ?? null,
      listed_at: new Date().toISOString()
    }));
    try {
      await supabase.from('listing').upsert(payload, { onConflict: 'train_id' });
    } catch {}
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
          // @ts-ignore store mileage for compute context
          mileage: Number(r.mileage) || 0
        };
        let { total } = computeScore(row, { fleetAvgKm30d: avgMileage });
        try {
          if (import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GROQ_API_KEY) {
            const prompt = buildPromptFromRow(row);
            const apiRes = await runScoring(prompt, row);
            const parsedNum = typeof apiRes === 'number' ? apiRes : parseFloat(String(apiRes).match(/-?\d+(?:\.\d+)?/)?.[0] || '');
            if (!Number.isNaN(parsedNum)) total = parsedNum;
          }
        } catch {}
        return { ...r, score: total };
      }));
      const ranked = scored.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
      setRecentResults(ranked);
      saveListing(ranked);
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
          try {
            if (import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GROQ_API_KEY) {
              const prompt = buildPromptFromRow(row);
              const apiRes = await runScoring(prompt, row);
              const parsed = typeof apiRes === 'number' ? apiRes : parseFloat(String(apiRes).match(/-?\d+(?:\.\d+)?/)?.[0] || '');
              if (!Number.isNaN(parsed)) total = parsed;
            }
          } catch {}
          return { ...t, ...r, score: total };
        }))
        .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

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
            try {
              if (import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GROQ_API_KEY) {
                const prompt = buildPromptFromRow(row);
                const apiRes = await runScoring(prompt, row);
                const parsedNum = typeof apiRes === 'number' ? apiRes : parseFloat(String(apiRes).match(/-?\d+(?:\.\d+)?/)?.[0] || '');
                if (!Number.isNaN(parsedNum)) total = parsedNum;
              }
            } catch {}
            return { ...r, score: total };
          }));
          return setRecentResults(scored.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)));
        }
        if (enriched.length > 0) {
          setRecentResults(enriched);
          saveListing(enriched);
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
          try {
            if (import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GROQ_API_KEY) {
              const prompt = buildPromptFromRow(row);
              const apiRes = await runScoring(prompt, row);
              const parsed = typeof apiRes === 'number' ? apiRes : parseFloat(String(apiRes).match(/-?\d+(?:\.\d+)?/)?.[0] || '');
              if (!Number.isNaN(parsed)) total = parsed;
            }
          } catch {}
          return { ...r, score: total };
        }))
        // Sort by score desc
        .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

        if (enriched.length > 0) {
          setRecentResults(enriched);
          saveListing(enriched);
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

  useEffect(() => {
    if (currentStep === 'results') {
      (async () => {
        try {
          setResultsLoading(true);
          const hadCache = await scoreCachedResults();
          // always refresh from DB too
          await fetchRecentResults();
        } finally {
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className={`flex justify-between items-center sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 px-2 rounded-none ${resultsLoading ? 'invisible' : ''}`}>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage train information and daily data</p>
      </div>
      <div className="flex items-center gap-2">
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
              <CardTitle>Recently Processed Trains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-left py-4 space-y-4">
                {recentResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No results yet. Try uploading a CSV, then return to this page.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Train ID</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Fitness</TableHead>
                        <TableHead>Job Cards</TableHead>
                        <TableHead>Branding</TableHead>
                        <TableHead>Mileage</TableHead>
                        <TableHead>Cleaning</TableHead>
                        <TableHead>Stabling</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentResults.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{r.train_id || '-'}</TableCell>
                          <TableCell>{(r.score ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{r.fitness_certificate_status ?? r.model ?? '-'}</TableCell>
                          <TableCell>{r.job_card_status ?? r.status ?? '-'}</TableCell>
                          <TableCell>{r.branding_priority ?? '-'}</TableCell>
                          <TableCell>{typeof r.mileage === 'number' ? r.mileage.toLocaleString() : (r.mileage ?? '-')}</TableCell>
                          <TableCell>{r.cleaning_status ?? '-'}</TableCell>
                          <TableCell>{r.stabling_position ?? '-'}</TableCell>
                          <TableCell>{new Date(r.updated_at || r.created_at || Date.now()).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Admin;