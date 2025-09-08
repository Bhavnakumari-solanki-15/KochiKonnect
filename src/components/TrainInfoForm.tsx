import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Train, Upload, FileText, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TrainInfo {
  id?: string;
  train_id: string;
  model: string;
  status: 'active' | 'maintenance' | 'retired';
}

interface TrainInfoFormProps {
  train?: TrainInfo | null;
  onSave: () => void;
  onCancel: () => void;
}

interface TrainCSVRow {
  train_id: string;
  model: string;
  status: string;
}

const TrainInfoForm = ({ train, onSave, onCancel }: TrainInfoFormProps) => {
  const [formData, setFormData] = useState<TrainInfo>({
    train_id: '',
    model: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<TrainCSVRow[]>([]);
  const [previewData, setPreviewData] = useState<TrainCSVRow[]>([]);
  const [uploadMode, setUploadMode] = useState<'single' | 'csv'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (train) {
      setFormData(train);
      setUploadMode('single');
    }
  }, [train]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setCsvFile(selectedFile);
      parseTrainCSV(selectedFile);
    }
  };

  const parseTrainCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Handle different line endings (Windows \r\n, Mac \r, Unix \n)
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      console.log('CSV Parsing Debug:');
      console.log('Total lines:', lines.length);
      console.log('First line (headers):', lines[0]);
      
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file must have at least a header and one data row",
          variant: "destructive",
        });
        return;
      }

      // Parse CSV with proper handling of quoted values
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
      
      console.log('Headers:', headers);
      console.log('Headers Lower:', headersLower);
      
      // Map different possible column names to our expected format
      const columnMapping: { [key: string]: string } = {
        'trainid': 'train_id',
        'train_id': 'train_id',
        'trainid': 'train_id',
        'train': 'train_id',
        'id': 'train_id',
        'manufacturer': 'model',
        'model': 'model',
        'type': 'model',
        'status': 'status',
        'state': 'status'
      };

      // Find the actual column indices
      const trainIdIndex = headersLower.findIndex(h => 
        ['trainid', 'train_id', 'train', 'id'].includes(h)
      );
      const modelIndex = headersLower.findIndex(h => 
        ['manufacturer', 'model', 'type'].includes(h)
      );
      const statusIndex = headersLower.findIndex(h => 
        ['status', 'state'].includes(h)
      );
      
      console.log('Column indices:');
      console.log('TrainID index:', trainIdIndex);
      console.log('Model index:', modelIndex);
      console.log('Status index:', statusIndex);

      // If status column is missing, we'll default all trains to 'active'
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

      // If status is missing, show a warning but continue
      if (statusIndex === -1) {
        toast({
          title: "Warning",
          description: "No Status column found. All trains will be set to 'active' status.",
          variant: "default",
        });
      }

      const data: TrainCSVRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        console.log(`Row ${i}:`, values);
        if (values.length === headers.length) {
          const row: TrainCSVRow = {
            train_id: values[trainIdIndex] || '',
            model: values[modelIndex] || '',
            status: statusIndex !== -1 ? (values[statusIndex] || 'active') : 'active'
          };
          console.log('Parsed row:', row);
          data.push(row);
        } else {
          console.log(`Row ${i} skipped - length mismatch: ${values.length} vs ${headers.length}`);
        }
      }

      console.log('Final parsed data:', data);
      setCsvData(data);
      setPreviewData(data.slice(0, 5)); // Show first 5 rows for preview
      
      toast({
        title: "CSV Parsed",
        description: `${data.length} trains loaded successfully`,
      });
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setCsvFile(null);
    setCsvData([]);
    setPreviewData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (uploadMode === 'csv' && csvData.length > 0) {
        // Upload multiple trains from CSV
        const trainsToInsert = csvData.map(row => ({
          train_id: row.train_id,
          model: row.model,
          status: row.status as 'active' | 'maintenance' | 'retired'
        }));

        // Try trains table first, fallback to train_data if it doesn't exist
        let { error } = await supabase
          .from('trains')
          .upsert(trainsToInsert, {
            onConflict: 'train_id'
          });

        if (error && (error.message.includes('trains') || error.message.includes('schema cache'))) {
          // Fallback: create basic train_data entries
          const trainDataEntries = csvData.map(row => ({
            train_id: row.train_id,
            fitness_certificate_status: 'valid',
            job_card_status: 'clear',
            branding_priority: 'medium',
            mileage: 0,
            cleaning_status: 'clean',
            stabling_position: 'Platform A'
          }));

          const { error: trainDataError } = await supabase
            .from('train_data')
            .upsert(trainDataEntries, {
              onConflict: 'train_id'
            });

          if (trainDataError) throw trainDataError;
        } else if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: `${csvData.length} trains uploaded successfully`,
        });
      } else {
        // Single train upload/update
        if (train?.id) {
          // Update existing train
          let { error } = await supabase
            .from('trains')
            .update({
              train_id: formData.train_id,
              model: formData.model,
              status: formData.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', train.id);

          if (error && (error.message.includes('trains') || error.message.includes('schema cache'))) {
            // Fallback: update train_data
            const { error: trainDataError } = await supabase
              .from('train_data')
              .upsert({
                train_id: formData.train_id,
                fitness_certificate_status: 'valid',
                job_card_status: 'clear',
                branding_priority: 'medium',
                mileage: 0,
                cleaning_status: 'clean',
                stabling_position: 'Platform A'
              }, {
                onConflict: 'train_id'
              });

            if (trainDataError) throw trainDataError;
          } else if (error) {
            throw error;
          }
        } else {
          // Create new train
          let { error } = await supabase
            .from('trains')
            .insert({
              train_id: formData.train_id,
              model: formData.model,
              status: formData.status
            });

          if (error && (error.message.includes('trains') || error.message.includes('schema cache'))) {
            // Fallback: create train_data entry
            const { error: trainDataError } = await supabase
              .from('train_data')
              .upsert({
                train_id: formData.train_id,
                fitness_certificate_status: 'valid',
                job_card_status: 'clear',
                branding_priority: 'medium',
                mileage: 0,
                cleaning_status: 'clean',
                stabling_position: 'Platform A'
              }, {
                onConflict: 'train_id'
              });

            if (trainDataError) throw trainDataError;
          } else if (error) {
            throw error;
          }
        }
      }

      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save train information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof TrainInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Train className="w-5 h-5" />
            {train ? 'Edit Train Information' : 'Add Train Information'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Upload Mode Selection */}
          {!train && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={uploadMode === 'single' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('single')}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Single Train
                </Button>
                <Button
                  type="button"
                  variant={uploadMode === 'csv' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('csv')}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV File
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CSV Upload Section */}
            {uploadMode === 'csv' && !train && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Select Train Info CSV File</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                    {csvFile && (
                      <Button type="button" variant="outline" onClick={clearFile}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {csvFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">{csvFile.name}</span>
                    <Badge variant="outline">{csvData.length} trains</Badge>
                  </div>
                )}

                {/* CSV Preview */}
                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Data Preview (First 5 trains)</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Train ID</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{row.train_id}</TableCell>
                              <TableCell>{row.model}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    row.status === 'active' ? 'default' : 
                                    row.status === 'maintenance' ? 'secondary' : 'destructive'
                                  }
                                >
                                  {row.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* CSV Format Info */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Required CSV Format</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Your CSV file must include the following columns (flexible naming):
                  </p>
                  <div className="space-y-2 text-sm text-blue-700 mb-3">
                    <div><strong>Train ID:</strong> trainid, train_id, train, or id (required)</div>
                    <div><strong>Model:</strong> manufacturer, model, or type (required)</div>
                    <div><strong>Status:</strong> status or state (optional - defaults to 'active')</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-800">Need a template?</span>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('/sample-train-info.csv', '_blank')}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Download Sample CSV
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Single Train Form */}
            {uploadMode === 'single' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="train_id">Train ID *</Label>
                    <Input
                      id="train_id"
                      value={formData.train_id}
                      onChange={(e) => handleInputChange('train_id', e.target.value)}
                      placeholder="e.g., TR001, KRL-001"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => handleInputChange('model', e.target.value)}
                      placeholder="e.g., Siemens Desiro, Alstom Coradia"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'maintenance' | 'retired') => 
                      handleInputChange('status', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || (uploadMode === 'csv' && csvData.length === 0)}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading 
                  ? (uploadMode === 'csv' ? 'Uploading...' : 'Saving...') 
                  : (uploadMode === 'csv' 
                      ? `Upload ${csvData.length} Trains` 
                      : train ? 'Update Train' : 'Add Train'
                    )
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainInfoForm;
