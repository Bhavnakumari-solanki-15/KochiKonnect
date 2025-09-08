import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { Clock, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const RecentActivity = () => {
  const { data: auditLogs, loading } = useSupabaseData({
    table: 'audit_logs',
    realtime: true
  });

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getActivityType = (notes: string) => {
    if (notes?.toLowerCase().includes('upload')) return 'upload';
    if (notes?.toLowerCase().includes('update')) return 'update';
    if (notes?.toLowerCase().includes('delete')) return 'delete';
    if (notes?.toLowerCase().includes('create')) return 'create';
    return 'activity';
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'upload': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'update': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const recentLogs = auditLogs?.slice(0, 5) || [];

  return (
    <Card className="h-full flex flex-col group relative overflow-hidden border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Live</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 pt-0">
        <div className="space-y-2">
          {recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            recentLogs.slice(0, 2).map((log, index) => {
              const activityType = getActivityType(log.notes || '');
              
              return (
                <div 
                  key={log.id || index}
                  className="group/item flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover/item:scale-110 transition-transform duration-200">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs font-medium px-1 py-0.5", getActivityColor(activityType))}
                      >
                        {activityType}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2 w-2" />
                        {formatTimestamp(log.timestamp || new Date().toISOString())}
                      </span>
                    </div>
                    
                    <p className="text-xs text-foreground font-medium line-clamp-1">
                      {log.notes || 'System activity'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
