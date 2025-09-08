import React from "react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover"
        style={{
          backgroundImage: 'url(/image.png)'
        }}
      />
      {/* Darker overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/50" />
      
      {/* Dashboard Content */}
      <div className="relative h-screen p-4 space-y-4 overflow-hidden">

        {/* Summary Stats */}
        <DashboardStats />

        {/* Charts and Analytics */}
        <DashboardCharts />

        {/* Footer */}
        <div className="text-center text-xs text-white/80 py-2">
          <p>Data updates automatically every few seconds • Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;