import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: LucideIcon;
  description?: string;
  className?: string;
}

export const SummaryCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  description,
  className 
}: SummaryCardProps) => {
  const getChangeColor = () => {
    if (!change) return 'text-muted-foreground';
    switch (change.type) {
      case 'increase': return 'text-emerald-600 dark:text-emerald-400';
      case 'decrease': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getChangeBgColor = () => {
    if (!change) return 'bg-muted/50';
    switch (change.type) {
      case 'increase': return 'bg-emerald-50 dark:bg-emerald-950/30';
      case 'decrease': return 'bg-red-50 dark:bg-red-950/30';
      default: return 'bg-muted/50';
    }
  };

  const getChangeIcon = () => {
    if (!change) return null;
    switch (change.type) {
      case 'increase': return <TrendingUp className="h-3 w-3" />;
      case 'decrease': return <TrendingDown className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden border-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-2xl",
      className
    )}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
              </div>
            </div>
            
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
          
          {change && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
              getChangeBgColor(),
              getChangeColor()
            )}>
              {getChangeIcon()}
              <span className="font-semibold">
                {change.type === 'increase' ? '+' : change.type === 'decrease' ? '-' : ''}{Math.abs(change.value)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Decorative element */}
        <div className="absolute -bottom-1 -right-1 h-16 w-16 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </CardContent>
    </Card>
  );
};
