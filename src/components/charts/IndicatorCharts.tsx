import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppContext } from '../../context/AppContext.tsx';
import type {
  BacktestResult,
  FeatureContribution,
  GarchResult,
  HoldingPosition,
  StockSeriesPoint,
} from '../../types/index.ts';

export const RsiChart: React.FC<{ series: StockSeriesPoint[] }> = ({ series }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  const data = series
    .filter((d) => d.rsi_14 !== null)
    .map((d) => ({ date: d.date.slice(2), rsi: Number(d.rsi_14!.toFixed(2)) }));

  return (
    <div className="h-44 w-full" data-testid="rsi-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} minTickGap={28} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <ReferenceLine y={70} stroke={isDark ? '#B76E85' : '#782F46'} strokeDasharray="4 4" />
          <ReferenceLine y={30} stroke={isDark ? '#34D399' : '#087F5B'} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="rsi"
            name="RSI (14)"
            stroke={isDark ? '#A78BFA' : '#6D28D9'}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MacdChart: React.FC<{ series: StockSeriesPoint[] }> = ({ series }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  const data = series
    .filter((d) => d.macd !== null && d.macd_signal !== null)
    .map((d) => ({
      date: d.date.slice(2),
      macd: Number(d.macd!.toFixed(2)),
      signal: Number(d.macd_signal!.toFixed(2)),
    }));

  return (
    <div className="h-44 w-full" data-testid="macd-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} minTickGap={28} />
          <YAxis tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke={isDark ? '#4B5563' : '#CBD5E1'} />
          <Line
            type="monotone"
            dataKey="macd"
            name="MACD"
            stroke={isDark ? '#34D399' : '#087F5B'}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="signal"
            name="Signal"
            stroke={isDark ? '#B76E85' : '#782F46'}
            strokeWidth={1.75}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ContributionChart: React.FC<{ contributions: FeatureContribution[] }> = ({
  contributions,
}) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  const top = contributions.slice(0, 8).map((c) => ({
    label: c.label,
    contribution: Number(c.contribution.toFixed(4)),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 20, left: 24, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 11, fill: isDark ? '#E5E7EB' : '#334155' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <ReferenceLine x={0} stroke={isDark ? '#6B7280' : '#94A3B8'} />
          <Bar dataKey="contribution" name="Impact" radius={[3, 3, 3, 3]}>
            {top.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.contribution >= 0
                    ? isDark
                      ? '#34D399'
                      : '#087F5B'
                    : isDark
                      ? '#B76E85'
                      : '#782F46'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const GarchVolatilityChart: React.FC<{ garch: GarchResult }> = ({ garch }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  const data = garch.series.map((s) => ({
    date: s.date.slice(2),
    vol: Number(s.conditionalVolAnnualPct.toFixed(2)),
    ret: Number(Math.abs(s.dailyReturnPct).toFixed(2)),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="vol"
            name="Annualized GARCH Vol (%)"
            stroke={isDark ? '#A78BFA' : '#6D28D9'}
            fill={isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(109, 40, 217, 0.14)'}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const EquityCurveChart: React.FC<{ backtest: BacktestResult }> = ({ backtest }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';

  // Downsample long curves gently for fast SVG rendering while preserving start & end
  const raw = backtest.equityCurve;
  const step = raw.length > 260 ? Math.ceil(raw.length / 260) : 1;
  const data = raw
    .filter((_, idx) => idx % step === 0 || idx === raw.length - 1)
    .map((pt) => ({
      date: pt.date.slice(2),
      strategy: Math.round(pt.strategyEquity),
      benchmark: Math.round(pt.benchmarkEquity),
    }));

  return (
    <div className="h-64 w-full" data-testid="equity-curve-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} minTickGap={28} />
          <YAxis
            tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }}
            tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(1)}L`}
          />
          <Tooltip
            formatter={(val) => `₹${Number(val ?? 0).toLocaleString('en-IN')}`}
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="strategy"
            name="Strategy Equity"
            stroke={isDark ? '#34D399' : '#087F5B'}
            strokeWidth={2.2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name="Buy & Hold Benchmark"
            stroke={isDark ? '#A78BFA' : '#782F46'}
            strokeWidth={1.75}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AllocationPieChart: React.FC<{
  holdings: HoldingPosition[];
  cashBalance: number;
}> = ({ holdings, cashBalance }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';

  const colors = isDark
    ? ['#34D399', '#A78BFA', '#B76E85', '#38BDF8', '#FBBF24', '#6B7280']
    : ['#087F5B', '#6D28D9', '#782F46', '#0284C7', '#D97706', '#64748B'];

  const data = [
    ...holdings.map((h) => ({ name: h.symbol, value: Math.round(h.marketValue) })),
    { name: 'Cash', value: Math.round(cashBalance) },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val) => `₹${Number(val ?? 0).toLocaleString('en-IN')}`}
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
