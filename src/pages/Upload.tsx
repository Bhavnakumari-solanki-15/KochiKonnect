import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload as UploadIcon, FileSpreadsheet, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [trainId, setTrainId] = useState("");
  const [dataType, setDataType] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const processUpload = async () => {
    if (!file || !trainId || !dataType) {
      toast({
        title: "Missing Information",
        description: "Please provide train ID, data type, and file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Parse CSV/Excel data (simplified for prototype)
      const text = await file.text();
      const lines = text.split('\n');
      
      // Ensure train exists
      const { error: trainError } = await supabase
        .from('trains')
        .upsert({ train_id: trainId, model: 'Metro Car' });

      if (trainError) throw trainError;

      // Process based on data type
      switch (dataType) {
        case 'fitness':
          await supabase.from('fitness_certificates').insert({
            train_id: trainId,
            certificate_type: 'Safety Certificate',
            issue_date: new Date().toISOString().split('T')[0],
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            is_valid: true
          });
          break;
        case 'job_cards':
          await supabase.from('job_cards').insert({
            train_id: trainId,
            job_description: notes || 'Uploaded job card',
            priority: 'medium',
            is_open: true
          });
          break;
        case 'mileage':
          await supabase.from('mileage_logs').insert({
            train_id: trainId,
            current_mileage: 5000,
            target_mileage: 10000,
            needs_balancing: true
          });
          break;
      }

      toast({
        title: "Upload Successful",
        description: `${dataType} data uploaded for train ${trainId}`,
      });

      // Reset form
      setFile(null);
      setTrainId("");
      setDataType("");
      setNotes("");
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error processing your upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const addManualEntry = async () => {
    if (!trainId || !dataType) {
      toast({
        title: "Missing Information",
        description: "Please provide train ID and data type.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure train exists
      const { error: trainError } = await supabase
        .from('trains')
        .upsert({ train_id: trainId, model: 'Metro Car' });

      if (trainError) throw trainError;

      // Add manual entry based on type
      switch (dataType) {
        case 'branding':
          await supabase.from('branding_priorities').insert({
            train_id: trainId,
            priority: 'high',
            campaign_name: 'Kochi Metro Branding',
            notes
          });
          break;
        case 'cleaning':
          await supabase.from('cleaning_slots').insert({
            train_id: trainId,
            cleaning_type: 'Deep Clean',
            is_pending: true,
            scheduled_date: new Date().toISOString().split('T')[0]
          });
          break;
        case 'stabling':
          await supabase.from('stabling_positions').insert({
            train_id: trainId,
            position_name: 'Platform A',
            requires_shunting: false,
            notes
          });
          break;
      }

      toast({
        title: "Entry Added",
        description: `Manual ${dataType} entry added for train ${trainId}`,
      });

      // Reset form
      setTrainId("");
      setDataType("");
      setNotes("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add manual entry.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Train Data Upload</h1>
        <p className="text-muted-foreground">Upload files or add manual entries for train induction planning</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="w-5 h-5" />
              File Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload CSV/Excel/JSON</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainId">Train ID</Label>
              <Input
                id="trainId"
                value={trainId}
                onChange={(e) => setTrainId(e.target.value)}
                placeholder="e.g., KMRL001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fitness">Fitness Certificates</SelectItem>
                  <SelectItem value="job_cards">Job Cards</SelectItem>
                  <SelectItem value="mileage">Mileage Logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            <Button 
              onClick={processUpload} 
              disabled={isUploading || !file || !trainId || !dataType}
              className="w-full"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {isUploading ? "Processing..." : "Upload & Process"}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Entry Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manualTrainId">Train ID</Label>
              <Input
                id="manualTrainId"
                value={trainId}
                onChange={(e) => setTrainId(e.target.value)}
                placeholder="e.g., KMRL001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualDataType">Entry Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branding">Branding Priority</SelectItem>
                  <SelectItem value="cleaning">Cleaning Slot</SelectItem>
                  <SelectItem value="stabling">Stabling Position</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualNotes">Details</Label>
              <Textarea
                id="manualNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter details..."
              />
            </div>

            <Button 
              onClick={addManualEntry}
              disabled={!trainId || !dataType}
              className="w-full"
              variant="secondary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Entry
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Upload;