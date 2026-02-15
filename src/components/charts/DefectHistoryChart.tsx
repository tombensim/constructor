'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush,
} from 'recharts';
import { categoryColors, categoryHebrewNames, WorkCategory } from '@/lib/status-mapper';

interface DefectHistoryDataPoint {
    date: string;
    categoryDefects: Record<string, number>;
}

interface DefectHistoryChartProps {
    data: DefectHistoryDataPoint[];
    categories: string[];
}

// Format date as DD/MM/YY
function formatDate(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
}

export function DefectHistoryChart({ data, categories }: DefectHistoryChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80 text-muted-foreground">
                אין נתוני היסטוריית ליקויים להצגה
            </div>
        );
    }

    // Transform data for Recharts
    const chartData = data.map((point) => ({
        date: point.date,
        ...point.categoryDefects,
    }));

    // Check if there are any defects at all
    const hasDefects = categories.some((cat) =>
        data.some((point) => (point.categoryDefects[cat] || 0) > 0)
    );

    if (!hasDefects) {
        return (
            <div className="flex items-center justify-center h-80 text-muted-foreground">
                אין ליקויים להצגה - כל העבודות תקינות! 🎉
            </div>
        );
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        type="category"
                        interval="preserveStartEnd"
                        tickFormatter={formatDate}
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        label={{ value: 'מספר ליקויים', angle: -90, position: 'insideLeft' }}
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        formatter={(value, name) => [
                            value,
                            categoryHebrewNames[name as WorkCategory] || name,
                        ]}
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                        }}
                    />
                    <Legend
                        formatter={(value) => categoryHebrewNames[value as WorkCategory] || value}
                        wrapperStyle={{ fontSize: '12px' }}
                    />
                    {categories.map((category) => {
                        // Only render line if category has defects
                        const hasData = data.some((point) => (point.categoryDefects[category] || 0) > 0);
                        if (!hasData) return null;

                        return (
                            <Line
                                key={category}
                                type="monotone"
                                dataKey={category}
                                stroke={categoryColors[category as WorkCategory] || '#6b7280'}
                                strokeWidth={2}
                                dot={{ fill: categoryColors[category as WorkCategory] || '#6b7280', r: 4 }}
                                activeDot={{ r: 6 }}
                                name={category}
                            />
                        );
                    })}
                    <Brush
                        dataKey="date"
                        height={30}
                        stroke="#3b82f6"
                        tickFormatter={formatDate}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
