import React from "react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Dashboard Content */}
      <div className="relative min-h-screen p-3 sm:p-4 md:p-6 space-y-4 overflow-hidden">

        {/* Summary Stats */}
        <DashboardStats />

        {/* Charts and Analytics */}
        <DashboardCharts />

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Data updates automatically every few seconds • Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;