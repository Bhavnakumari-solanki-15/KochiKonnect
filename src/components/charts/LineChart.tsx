import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";

interface LineChartProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
    [key: string]: any;
  }>;
  dataKey: string;
  color?: string;
  height?: number;
  description?: string;
  className?: string;
  showArea?: boolean;
  showDots?: boolean;
}

export const LineChart = ({ 
  title, 
  data, 
  dataKey, 
  color = "#3b82f6", 
  height = 300,
  description,
  className,
  showArea = true,
  showDots = true
}: LineChartProps) => {
  const chartConfig = {
    [dataKey]: {
      label: title,
      color: color,
    },
  };

  const formatXAxisLabel = (value: string) => {
    // Format date strings to be more readable
    if (value.includes('/')) {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return value;
  };

  const formatYAxisLabel = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <Card className={cn("group relative overflow-hidden border-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-2xl", className)}>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 pt-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--muted))" 
              opacity={0.3}
            />
            
            <XAxis 
              dataKey="name" 
              tick={{ 
                fontSize: 10, 
                fill: 'hsl(var(--muted-foreground))',
                fontWeight: 500
              }} 
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={formatXAxisLabel}
            />
            
            <YAxis 
              tick={{ 
                fontSize: 10, 
                fill: 'hsl(var(--muted-foreground))',
                fontWeight: 500
              }} 
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={formatYAxisLabel}
            />
            
            <ChartTooltip 
              content={<ChartTooltipContent 
                className="rounded-lg border bg-background shadow-lg"
                formatter={(value: any) => [formatYAxisLabel(value), title]}
              />} 
              cursor={{ 
                stroke: color, 
                strokeWidth: 2,
                strokeDasharray: '5 5',
                opacity: 0.6
              }} 
            />
            
            {showArea && (
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={3}
                fill={`url(#grad-${dataKey})`}
                filter="url(#glow)"
                dot={showDots ? { 
                  fill: color, 
                  strokeWidth: 2, 
                  r: 4,
                  stroke: '#fff'
                } : false}
                activeDot={{ 
                  r: 6, 
                  stroke: color, 
                  strokeWidth: 2,
                  fill: '#fff',
                  filter: 'url(#glow)'
                }}
              />
            )}
            
            {!showArea && (
              <Line 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={3}
                dot={showDots ? { 
                  fill: color, 
                  strokeWidth: 2, 
                  r: 4,
                  stroke: '#fff'
                } : false}
                activeDot={{ 
                  r: 6, 
                  stroke: color, 
                  strokeWidth: 2,
                  fill: '#fff',
                  filter: 'url(#glow)'
                }}
                filter="url(#glow)"
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
