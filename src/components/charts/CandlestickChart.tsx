import React, { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import { useAppContext } from '../../context/AppContext.tsx';
import type { StockSeriesPoint } from '../../types/index.ts';

interface CandlestickChartProps {
  symbol: string;
  series: StockSeriesPoint[];
  showSma20: boolean;
  showSma50: boolean;
  showEma: boolean;
  showBollinger: boolean;
  height?: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  series,
  showSma20,
  showSma50,
  showEma,
  showBollinger,
  height = 400,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useAppContext();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    const isDark = theme === 'dark';
    const upColor = isDark ? '#34D399' : '#087F5B';
    const downColor = isDark ? '#B76E85' : '#782F46';
    const textColor = isDark ? '#D1D5DB' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const bgColor = isDark ? '#1F2937' : '#FFFFFF';

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: false,
      },
      crosshair: {
        vertLine: { labelBackgroundColor: isDark ? '#374151' : '#1E293B' },
        horzLine: { labelBackgroundColor: isDark ? '#374151' : '#1E293B' },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    candleSeries.setData(
      series.map((d) => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      series.map((d) => ({
        time: d.date as Time,
        value: d.volume,
        color:
          d.close >= d.open
            ? isDark
              ? 'rgba(52, 211, 153, 0.28)'
              : 'rgba(8, 127, 91, 0.25)'
            : isDark
              ? 'rgba(183, 110, 133, 0.28)'
              : 'rgba(120, 47, 70, 0.25)',
      })),
    );

    const addLineOverlay = (
      values: Array<{ time: Time; value: number }>,
      color: string,
      title: string,
      lineStyle = 0,
    ) => {
      if (values.length === 0) return;
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        title,
        lineStyle,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(values);
    };

    if (showSma20) {
      addLineOverlay(
        series.filter((d) => d.sma_20 !== null).map((d) => ({ time: d.date as Time, value: d.sma_20! })),
        isDark ? '#A78BFA' : '#6D28D9',
        'SMA 20',
      );
    }

    if (showSma50) {
      addLineOverlay(
        series.filter((d) => d.sma_50 !== null).map((d) => ({ time: d.date as Time, value: d.sma_50! })),
        '#D97706',
        'SMA 50',
      );
    }

    if (showEma) {
      addLineOverlay(
        series.filter((d) => d.ema_12 !== null).map((d) => ({ time: d.date as Time, value: d.ema_12! })),
        '#0284C7',
        'EMA 12',
      );
      addLineOverlay(
        series.filter((d) => d.ema_26 !== null).map((d) => ({ time: d.date as Time, value: d.ema_26! })),
        '#EA580C',
        'EMA 26',
      );
    }

    if (showBollinger) {
      addLineOverlay(
        series.filter((d) => d.bb_upper !== null).map((d) => ({ time: d.date as Time, value: d.bb_upper! })),
        isDark ? 'rgba(167, 139, 250, 0.55)' : 'rgba(109, 40, 217, 0.45)',
        'BB Upper',
        2,
      );
      addLineOverlay(
        series.filter((d) => d.bb_lower !== null).map((d) => ({ time: d.date as Time, value: d.bb_lower! })),
        isDark ? 'rgba(167, 139, 250, 0.55)' : 'rgba(109, 40, 217, 0.45)',
        'BB Lower',
        2,
      );
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [series, symbol, theme, showSma20, showSma50, showEma, showBollinger, height]);

  if (series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500">
        No OHLCV data available for this selection.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="candlestick-chart"
      className="w-full overflow-hidden rounded-lg"
      style={{ height }}
    />
  );
};
