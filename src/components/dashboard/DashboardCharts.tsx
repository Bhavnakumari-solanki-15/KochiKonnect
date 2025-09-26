import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const DashboardCharts = () => {
  const { data: trainData, loading: trainsLoading } = useSupabaseData({
    table: 'train_data',
    realtime: true
  });

  // Remove branding_priorities table usage since we'll get data from train_data

  const { data: mileageLogs, loading: mileageLoading } = useSupabaseData({
    table: 'mileage_logs',
    realtime: true
  });

  const { data: trains, loading: trainsStatusLoading } = useSupabaseData({
    table: 'trains',
    realtime: true
  });

  const { data: csvUploads, loading: csvUploadsLoading } = useSupabaseData({
    table: 'csv_uploads',
    realtime: true
  });

  // Process data for charts
  const getField = (row: any, keys: string[], fallback?: any) => {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    }
    return fallback;
  };
  const processMileageTrend = () => {
    // When there is no data, return an empty array instead of samples
    const emptyData: any[] = [];

    if (!mileageLogs || mileageLogs.length === 0) {
      // Fallback to train_data if mileage_logs is empty
      if (!trainData || trainData.length === 0) {
        return emptyData;
      }
      
    const grouped = trainData.reduce((acc: any, train: any) => {
      const createdAt = getField(train, ['created_at', 'createdAt', 'inserted_at']);
      const date = createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 };
      }
      const mileageVal = Number(getField(train, ['mileage', 'MileageTotalKM', 'current_mileage'], 0)) || 0;
      acc[date].total += mileageVal;
      acc[date].count += 1;
      return acc;
    }, {});

      const result = Object.entries(grouped).map(([date, data]: [string, any]) => ({
        name: date,
        value: Math.round(data.total / data.count),
        mileage: Math.round(data.total / data.count)
      })).slice(-7);

      return result.length > 0 ? result : emptyData;
    }

    // Use dedicated mileage_logs table
    const grouped = mileageLogs.reduce((acc: any, log: any) => {
      const date = new Date(getField(log, ['log_date', 'created_at'], new Date())).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 };
      }
      acc[date].total += log.current_mileage || 0;
      acc[date].count += 1;
      return acc;
    }, {});

    const result = Object.entries(grouped).map(([date, data]: [string, any]) => ({
      name: date,
      value: Math.round(data.total / data.count),
      mileage: Math.round(data.total / data.count)
    })).slice(-7);

    return result.length > 0 ? result : emptyData;
  };

  const processBrandingPriority = () => {
    if (!trainData || trainData.length === 0) {
      // Return zeroed data if no data available
      return [
        { name: 'High', value: 0, color: '#ef4444' },
        { name: 'Medium', value: 0, color: '#f59e0b' },
        { name: 'Low', value: 0, color: '#10b981' },
      ];
    }
    
    // Debug: Log the first few rows to see what fields are available
    console.log('Sample train data for branding priority:', trainData.slice(0, 3));
    
    const counts = trainData.reduce((acc: any, row: any) => {
      // Try multiple possible field names for branding priority
      const key = row.branding_priority || row.priority || row.brandingPriority || 'low';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Branding priority counts:', counts);
    
    const result = [
      { name: 'High', value: counts.high || counts.High || 0, color: '#ef4444' },
      { name: 'Medium', value: counts.medium || counts.Medium || 0, color: '#f59e0b' },
      { name: 'Low', value: counts.low || counts.Low || 0, color: '#10b981' },
    ];

    console.log('Branding priority result:', result);

    // If no data, return zeros
    return result.some(r => r.value > 0) ? result : [
      { name: 'High', value: 0, color: '#ef4444' },
      { name: 'Medium', value: 0, color: '#f59e0b' },
      { name: 'Low', value: 0, color: '#10b981' },
    ];
  };

  const processTrainStatus = () => {
    if (!trains || trains.length === 0) {
      return [
        { name: 'Active', value: 0, color: '#10b981' },
        { name: 'Maintenance', value: 0, color: '#f59e0b' },
        { name: 'Retired', value: 0, color: '#6b7280' }
      ];
    }
    const counts = trains.reduce((acc: any, t: any) => {
      const status = String(t.status || '').toLowerCase();
      if (status.includes('active')) acc.active = (acc.active || 0) + 1;
      else if (status.includes('maintenance')) acc.maintenance = (acc.maintenance || 0) + 1;
      else if (status.includes('retired')) acc.retired = (acc.retired || 0) + 1;
      else acc.active = (acc.active || 0) + 1; // default bucket
      return acc;
    }, {});
    return [
      { name: 'Active', value: counts.active || 0, color: '#10b981' },
      { name: 'Maintenance', value: counts.maintenance || 0, color: '#f59e0b' },
      { name: 'Retired', value: counts.retired || 0, color: '#6b7280' }
    ];
  };

  const processFitnessCertificateStatus = () => {
    if (!trainData || trainData.length === 0) {
      return [
        { name: 'Valid', value: 0, color: '#10b981' },
        { name: 'Expired', value: 0, color: '#ef4444' },
        { name: 'Pending', value: 0, color: '#f59e0b' },
        { name: 'Unknown', value: 0, color: '#6b7280' }
      ];
    }
    const counts = trainData.reduce((acc: any, r: any) => {
      const key = String(getField(r, ['fitness_certificate_status','FitnessCertificateStatus'], 'unknown')).toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { name: 'Valid', value: counts.valid || 0, color: '#10b981' },
      { name: 'Expired', value: counts.expired || 0, color: '#ef4444' },
      { name: 'Pending', value: counts.pending || 0, color: '#f59e0b' },
      { name: 'Unknown', value: counts.unknown || 0, color: '#6b7280' }
    ];
  };

  const processJobCardStatus = () => {
    if (!trainData || trainData.length === 0) {
      return [
        { name: 'Open', value: 0, color: '#ef4444' },
        { name: 'Closed', value: 0, color: '#10b981' },
        { name: 'Pending', value: 0, color: '#f59e0b' },
        { name: 'In Progress', value: 0, color: '#3b82f6' }
      ];
    }
    const counts = trainData.reduce((acc: any, r: any) => {
      const key = String(getField(r, ['job_card_status','JobCardStatus'], '')).toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { name: 'Open', value: counts.open || 0, color: '#ef4444' },
      { name: 'Closed', value: counts.closed || 0, color: '#10b981' },
      { name: 'Pending', value: counts.pending || 0, color: '#f59e0b' },
      { name: 'In Progress', value: counts['in_progress'] || counts['in progress'] || 0, color: '#3b82f6' }
    ];
  };

  const processCleaningStatus = () => {
    if (!trainData || trainData.length === 0) {
      return [
        { name: 'Clean', value: 0, color: '#10b981' },
        { name: 'Pending', value: 0, color: '#f59e0b' },
        { name: 'In Progress', value: 0, color: '#3b82f6' },
        { name: 'Dirty', value: 0, color: '#ef4444' }
      ];
    }

    const normalize = (valueRaw: any): 'clean' | 'pending' | 'in_progress' | 'dirty' | 'unknown' => {
      const v = String(valueRaw || '').toLowerCase().trim();
      if (!v) return 'unknown';
      const compact = v.replace(/[^a-z]/g, ''); // e.g., "in-progress" -> "inprogress"
      // Heuristic mapping using inclusion tests handles many variations
      if (compact.includes('dirty') || compact.includes('unclean') || compact.includes('fail')) return 'dirty';
      if (compact.includes('inprogress') || compact.includes('processing') || compact.includes('ongoing') || compact.includes('working') || compact.includes('wip')) return 'in_progress';
      if (compact.includes('pending') || compact.includes('scheduled') || compact.includes('await') || compact.includes('queue') || compact.includes('queued') || compact.includes('backlog') || compact.includes('yettoclean')) return 'pending';
      // clean last to avoid matching 'not clean'
      if ((compact.includes('clean') || compact.includes('complete') || compact.includes('completed') || compact.includes('finished') || compact.includes('done') || compact.includes('cleared') || compact.includes('pass')) && !compact.includes('notclean')) return 'clean';
      return 'unknown';
    };

    const tallies = { clean: 0, pending: 0, in_progress: 0, dirty: 0 } as Record<string, number>;
    for (const row of trainData) {
      const raw = getField(row, ['cleaning_status','CleaningStatus','cleaningStatus','Cleaning Status','clean_status','cleaningstatus'], 'unknown');
      const mapped = normalize(raw);
      if (mapped in tallies) tallies[mapped] += 1;
    }

    return [
      { name: 'Clean', value: tallies.clean, color: '#10b981' },
      { name: 'Pending', value: tallies.pending, color: '#f59e0b' },
      { name: 'In Progress', value: tallies.in_progress, color: '#3b82f6' },
      { name: 'Dirty', value: tallies.dirty, color: '#ef4444' }
    ];
  };

  const processMileageDistribution = () => {
    if (!trainData || trainData.length === 0) {
      // Return zeroed data if no data available
      return [
        { name: '0-50K', value: 0, color: '#10b981' },
        { name: '50K-100K', value: 0, color: '#3b82f6' },
        { name: '100K-150K', value: 0, color: '#f59e0b' },
        { name: '150K+', value: 0, color: '#ef4444' }
      ];
    }
    
    const mileageRanges = [
      { name: '0-50K', min: 0, max: 50000, color: '#10b981' },
      { name: '50K-100K', min: 50000, max: 100000, color: '#3b82f6' },
      { name: '100K-150K', min: 100000, max: 150000, color: '#f59e0b' },
      { name: '150K+', min: 150000, max: Infinity, color: '#ef4444' }
    ];

    const distribution = mileageRanges.map(range => {
      const count = trainData.filter((train: any) => {
        const mileage = Number(getField(train, ['mileage','MileageTotalKM','current_mileage'], 0)) || 0;
        return mileage >= range.min && mileage < range.max;
      }).length;

      return {
        name: range.name,
        value: count,
        color: range.color
      };
    });

    // If no data, return zeros
    return distribution.some(d => d.value > 0) ? distribution : [
      { name: '0-50K', value: 0, color: '#10b981' },
      { name: '50K-100K', value: 0, color: '#3b82f6' },
      { name: '100K-150K', value: 0, color: '#f59e0b' },
      { name: '150K+', value: 0, color: '#ef4444' }
    ];
  };

  if (trainsLoading || mileageLoading || trainsStatusLoading || csvUploadsLoading) {
    return (
      <div className="space-y-6 flex-1">
        {/* First Row Loading */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 h-64">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="flex-1 p-4">
                <Skeleton className="h-full w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Second Row Loading */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 h-64">
          {[...Array(3)].map((_, i) => (
            <Card key={i + 2} className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="flex-1 p-4">
                <Skeleton className="h-full w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Third Row Loading */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 h-64">
          {[...Array(2)].map((_, i) => (
            <Card key={i + 5} className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="flex-1 p-4">
                <Skeleton className="h-full w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Debug: Log data to console
  console.log('Dashboard Data:', {
    trainData: trainData?.length || 0,
    trains: trains?.length || 0,
    mileageLogs: mileageLogs?.length || 0,
    brandingPriority: processBrandingPriority(),
    trainStatus: processTrainStatus(),
    fitnessStatus: processFitnessCertificateStatus(),
    jobCardStatus: processJobCardStatus(),
    cleaningStatus: processCleaningStatus(),
    mileageDistribution: processMileageDistribution()
  });

  // Debug: Log the actual data being passed to pie charts
  console.log('Pie Chart Data Debug:', {
    trainStatusData: processTrainStatus(),
    fitnessData: processFitnessCertificateStatus(),
    jobCardData: processJobCardStatus(),
    cleaningData: processCleaningStatus()
  });

  return (
    <div className="space-y-5 flex-1">
      {/* First Row - All Pie Charts */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 h-auto">
        <PieChart
          title="Train Status"
          data={processTrainStatus()}
          dataKey="value"
          color="#3b82f6"
          description="Fleet status"
          showLegend={true}
          showLabel={true}
          className="h-full"
        />
        
        <PieChart
          title="Fitness Certificates"
          data={processFitnessCertificateStatus()}
          dataKey="value"
          color="#3b82f6"
          description="Certificate status"
          showLegend={true}
          showLabel={true}
          className="h-full"
        />
        
        <PieChart
          title="Job Card Status"
          data={processJobCardStatus()}
          dataKey="value"
          color="#3b82f6"
          description="Maintenance status"
          showLegend={true}
          showLabel={true}
          className="h-full"
        />
        
        <PieChart
          title="Cleaning Status"
          data={processCleaningStatus()}
          dataKey="value"
          color="#3b82f6"
          description="Cleaning status"
          showLegend={true}
          showLabel={true}
          className="h-full"
        />
      </div>

      {/* Second Row - Bar Charts & CSV Uploads */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 h-auto">
        <BarChart
          title="Branding Priority"
          data={processBrandingPriority()}
          dataKey="value"
          color="#3b82f6"
          description="Priority levels"
          showGradient={true}
          className="h-full"
        />
        
        <BarChart
          title="Mileage Distribution"
          data={processMileageDistribution()}
          dataKey="value"
          color="#3b82f6"
          description="Mileage ranges"
          showGradient={true}
          className="h-full"
        />
        
        <Card className="group relative overflow-hidden border-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-2xl h-full flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">CSV Uploads</CardTitle>
                <p className="text-xs text-muted-foreground">Total files uploaded</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 pt-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold text-foreground mb-2">
                {csvUploads?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                {csvUploads?.length === 1 ? 'file' : 'files'} uploaded
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


