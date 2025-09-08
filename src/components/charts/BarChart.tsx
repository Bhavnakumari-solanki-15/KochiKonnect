import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface BarChartProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
    color?: string;
    [key: string]: any;
  }>;
  dataKey: string;
  color?: string;
  height?: number;
  description?: string;
  className?: string;
  showGradient?: boolean;
  showValues?: boolean;
}

export const BarChart = ({ 
  title, 
  data, 
  dataKey, 
  color = "#3b82f6", 
  height = 300,
  description,
  className,
  showGradient = true,
  showValues = true
}: BarChartProps) => {
  const chartConfig = {
    [dataKey]: {
      label: title,
      color: color,
    },
  };

  const getBarColor = (entry: any, index: number) => {
    if (entry.color) return entry.color;
    
    // Default color scheme for different priorities
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
    return colors[index % colors.length];
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
    <Card className={cn("group relative overflow-hidden border-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-2xl h-full flex flex-col", className)}>
      <CardHeader className="pb-1 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex gap-1">
              {data.slice(0, 2).map((item, index) => (
                <div 
                  key={index}
                  className="h-1.5 w-1.5 rounded-full" 
                  style={{ backgroundColor: getBarColor(item, index) }} 
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 pt-0 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <RechartsBarChart 
            data={data} 
            width={undefined} 
            height={undefined}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            className="w-full h-full"
          >
            <defs>
              {data.map((entry, index) => (
                <linearGradient key={index} id={`bar-${dataKey}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={getBarColor(entry, index)} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={getBarColor(entry, index)} stopOpacity={0.3} />
                </linearGradient>
              ))}
              <filter id="barGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
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
                fontSize: 9, 
                fill: 'hsl(var(--muted-foreground))',
                fontWeight: 500
              }} 
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={0}
              height={25}
            />
            
            <YAxis 
              tick={{ 
                fontSize: 9, 
                fill: 'hsl(var(--muted-foreground))',
                fontWeight: 500
              }} 
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={formatYAxisLabel}
              width={35}
            />
            
            <ChartTooltip 
              content={<ChartTooltipContent 
                className="rounded-lg border bg-background shadow-lg"
                formatter={(value: any) => [formatYAxisLabel(value), title]}
              />} 
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
            />
            
            <Bar 
              dataKey={dataKey} 
              radius={[4, 4, 0, 0]}
              className="transition-all duration-300 hover:opacity-90"
              filter="url(#barGlow)"
              maxBarSize={60}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={showGradient ? `url(#bar-${dataKey}-${index})` : getBarColor(entry, index)}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
