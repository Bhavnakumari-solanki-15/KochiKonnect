import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";

interface PieChartProps {
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
  showLegend?: boolean;
  showLabel?: boolean;
}

export const PieChart = ({ 
  title, 
  data, 
  dataKey, 
  color = "#3b82f6", 
  height = 300,
  description,
  className,
  showLegend = true,
  showLabel = true
}: PieChartProps) => {
  // Debug: Log the data being passed to PieChart
  console.log(`PieChart ${title} data:`, data);
  
  const chartConfig = {
    [dataKey]: {
      label: title,
      color: color,
    },
  };

  const getDefaultColor = (index: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[index % colors.length];
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (!showLabel || percent < 0.08) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Ensure all categories render even when some are zero by applying a tiny
  // visual placeholder value for zero slices (without changing raw counts).
  const rawData = Array.isArray(data) ? data : [];
  const rawTotal = rawData.reduce((s, d: any) => s + (Number((d as any)[dataKey]) || 0), 0);
  const epsilon = rawTotal > 0 ? rawTotal * 0.0001 : 0; // tiny value for visibility
  const adjustedData = rawData.map((d: any) => {
    const val = Number((d as any)[dataKey]) || 0;
    return val === 0 && rawTotal > 0
      ? { ...d, [dataKey]: epsilon }
      : d;
  });

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
                  style={{ backgroundColor: item.color || getDefaultColor(index) }} 
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 pt-0 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <RechartsPieChart 
            width={undefined} 
            height={undefined}
            className="w-full h-full"
          >
            <Pie
              data={adjustedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius="80%"
              innerRadius="30%"
              fill="#8884d8"
              dataKey={dataKey}
              stroke="white"
              strokeWidth={2}
            >
              {adjustedData.map((entry, index) => {
                console.log(`PieChart Cell ${index}:`, entry.color, entry);
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || getDefaultColor(index)}
                  />
                );
              })}
            </Pie>
            <ChartTooltip 
              content={<ChartTooltipContent 
                className="rounded-lg border bg-background shadow-lg"
                formatter={(value: any, name: any) => [value, name]}
              />} 
            />
            {showLegend && (
              <Legend 
                verticalAlign="bottom" 
                height={20}
                iconType="circle"
                wrapperStyle={{ fontSize: '9px', paddingTop: '3px' }}
                formatter={(value, entry: any) => {
                  const original = rawData.find((d: any) => d.name === value);
                  const count = Number(original?.[dataKey]) || 0;
                  return (
                    <span style={{ color: entry.color, fontSize: '9px', fontWeight: 500 }}>
                      {value} {count > 0 ? `(${count})` : ''}
                    </span>
                  );
                }}
              />
            )}
          </RechartsPieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};