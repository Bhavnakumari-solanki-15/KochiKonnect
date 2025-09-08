import React from "react";
import { SummaryCard } from "@/components/charts/SummaryCard";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Train, ClipboardList, Brush, TrendingUp, Shield, AlertTriangle } from "lucide-react";

export const DashboardStats = () => {
  const { data: trains, loading: trainsLoading, error: trainsError } = useSupabaseData({
    table: 'trains',
    realtime: true
  });

  const { data: trainData, loading: trainDataLoading, error: trainDataError } = useSupabaseData({
    table: 'train_data',
    realtime: true
  });

  // Debug logging - show data from both tables
  console.log('Dashboard Stats Data:', {
    trainsCount: trains?.length || 0,
    trainsError,
    trainsSample: trains?.slice(0, 2),
    trainsFields: trains?.[0] ? Object.keys(trains[0]) : [],
    trainsSampleRecord: trains?.[0],
    trainDataCount: trainData?.length || 0,
    trainDataError,
    trainDataSample: trainData?.slice(0, 2),
    trainDataFields: trainData?.[0] ? Object.keys(trainData[0]) : [],
    trainDataSampleRecord: trainData?.[0]
  });

  // Test basic connection to both tables
  React.useEffect(() => {
    const testConnection = async () => {
      try {
        const { data: trainsData, error: trainsError } = await supabase.from('trains').select('*').limit(1);
        console.log('Connection test - trains table:', { data: trainsData, error: trainsError });
        
        const { data: trainDataData, error: trainDataError } = await supabase.from('train_data').select('*').limit(1);
        console.log('Connection test - train_data table:', { data: trainDataData, error: trainDataError });
      } catch (err) {
        console.error('Connection test failed:', err);
      }
    };
    testConnection();
  }, []);

  // Calculate stats from trains table (main data) and train_data table (additional info)
  const totalTrains = trains?.length || 0;
  
  // Debug train statuses from trains table
  const trainStatusCounts = trains?.reduce((acc: any, train: any) => {
    const status = train.status || 'null';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log('Train Status Counts from trains table:', trainStatusCounts);
  
  // Count active trains from trains table
  const activeTrains = trains?.filter((train: any) => {
    const status = train.status?.toLowerCase();
    return status === 'active';
  }).length || 0;
  
  console.log('Calculated Active Trains:', activeTrains, 'out of', totalTrains, 'total trains');
  
  // Debug job card statuses
  const jobCardStatusCounts = trainData?.reduce((acc: any, train: any) => {
    const status = train.job_card_status || 'null';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log('Job Card Status Counts:', jobCardStatusCounts);
  
  // Job cards from train_data table - check for various open statuses
  const openJobs = trainData?.filter((train: any) => {
    const status = train.job_card_status?.toLowerCase();
    return status === 'open' || status === 'pending' || status === 'in_progress' || status === 'active';
  }).length || 0;
  
  const criticalJobs = trainData?.filter((train: any) => {
    const jobStatus = train.job_card_status?.toLowerCase();
    const priority = train.branding_priority?.toLowerCase();
    return (jobStatus === 'open' || jobStatus === 'pending' || jobStatus === 'in_progress') && 
           (priority === 'high' || priority === 'critical');
  }).length || 0;
  
  // Debug cleaning statuses
  const cleaningStatusCounts = trainData?.reduce((acc: any, train: any) => {
    const status = train.cleaning_status || 'null';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log('Cleaning Status Counts:', cleaningStatusCounts);
  
  // Cleaning status from train_data table - check for various pending statuses
  const pendingCleaning = trainData?.filter((train: any) => {
    const status = train.cleaning_status?.toLowerCase();
    return status === 'pending' || status === 'in_progress' || status === 'scheduled' || status === 'dirty';
  }).length || 0;
  
  // Calculate average mileage from train_data
  const avgMileage = trainData?.length 
    ? Math.round(trainData.reduce((sum: number, train: any) => sum + (train.mileage || 0), 0) / trainData.length)
    : 0;

  // Calculate fitness certificate status
  const validFitness = trainData?.filter((train: any) => train.fitness_certificate_status === 'valid').length || 0;
  const fitnessPercentage = totalTrains > 0 ? Math.round((validFitness / totalTrains) * 100) : 0;

  // Calculate change percentages (mock data for now)
  const getChangeValue = (current: number, type: string) => {
    // In a real app, you'd compare with previous period data
    const mockChanges: { [key: string]: number } = {
      'trains': 5,
      'jobs': openJobs > 0 ? 12 : -8,
      'cleaning': 0,
      'mileage': 2,
      'fitness': fitnessPercentage > 80 ? 5 : 0
    };
    return mockChanges[type] || 0;
  };

  // Show error state if there are connection issues
  if (trainsError || trainDataError) {
    console.error('Supabase connection error:', { trainsError, trainDataError });
  }

  if (trainsLoading || trainDataLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="Active Trains"
        value={activeTrains}
        icon={Train}
        change={{
          value: Math.abs(getChangeValue(activeTrains, 'trains')),
          type: getChangeValue(activeTrains, 'trains') > 0 ? 'increase' : 'decrease'
        }}
        description={`${totalTrains} total in trains table`}
      />
      
      <SummaryCard
        title="Open Job Cards"
        value={openJobs}
        icon={ClipboardList}
        change={{
          value: Math.abs(getChangeValue(openJobs, 'jobs')),
          type: getChangeValue(openJobs, 'jobs') > 0 ? 'increase' : 'decrease'
        }}
        description={`${criticalJobs} high priority`}
      />
      
      <SummaryCard
        title="Pending Cleaning"
        value={pendingCleaning}
        icon={Brush}
        change={{
          value: Math.abs(getChangeValue(pendingCleaning, 'cleaning')),
          type: getChangeValue(pendingCleaning, 'cleaning') > 0 ? 'increase' : 'decrease'
        }}
        description="Pending or in progress"
      />
      
      <SummaryCard
        title="Avg. Mileage"
        value={avgMileage.toLocaleString()}
        icon={TrendingUp}
        change={{
          value: Math.abs(getChangeValue(avgMileage, 'mileage')),
          type: getChangeValue(avgMileage, 'mileage') > 0 ? 'increase' : 'decrease'
        }}
        description="From train_data table"
      />
    </div>
  );
};
