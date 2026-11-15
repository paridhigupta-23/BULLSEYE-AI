import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import type { VirtualPortfolio, WhatIfSimulationResult } from '../../practice-intelligence/types.ts';
import { runWhatIfSimulation } from '../../practice-intelligence/what-if-simulator/simulator.ts';
import { formatINR, formatPct } from '../../types/index.ts';

interface WhatIfSimulatorViewProps {
  portfolio: VirtualPortfolio;
}

export const WhatIfSimulatorView: React.FC<WhatIfSimulatorViewProps> = ({ portfolio }) => {
  const [priceShockPct, setPriceShockPct] = useState<number>(5);
  const [customInvestmentDelta, setCustomInvestmentDelta] = useState<number>(0);

  const simulation: WhatIfSimulationResult = runWhatIfSimulation(portfolio, {
    targetSymbol: 'ALL',
    priceChangePct: priceShockPct,
    hypotheticalInvestmentDelta: customInvestmentDelta,
  });

  const shockPresets = [-10, -5, 5, 10];

  const handleReset = () => {
    setPriceShockPct(0);
    setCustomInvestmentDelta(0);
  };

  const deltaEquity = simulation.absoluteProfitLoss;
  const deltaPct = simulation.percentageChange;

  return (
    <div className="space-y-6">
      {/* Mandatory Disclaimer */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200 backdrop-blur-sm flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider text-amber-300">
            {simulation.disclaimer}
          </span>
          <p className="mt-0.5 text-slate-300">
            Simulations evaluate mathematical sensitivity under hypothetical market conditions. They do NOT alter your actual virtual wallet or constitute financial advice.
          </p>
        </div>
      </div>

      {/* Simulator Controls Card */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Play className="h-4 w-4 text-cyan-400 fill-cyan-400/30" />
              Scenario Parameters
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select or slide an instantaneous market shock and optionally inject additional virtual cash.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 self-start md:self-auto rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Scenario</span>
          </button>
        </div>

        {/* Shock Presets & Slider */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Instantaneous Price Shock
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {shockPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPriceShockPct(preset)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                    priceShockPct === preset
                      ? preset < 0
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                        : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'border border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-750 hover:text-white'
                  }`}
                >
                  {preset > 0 ? `+${preset}%` : `${preset}%`}
                </button>
              ))}
              <span className="font-mono text-xs font-bold text-cyan-400 ml-auto">
                Current: {priceShockPct > 0 ? `+${priceShockPct}%` : `${priceShockPct}%`}
              </span>
            </div>

            <input
              type="range"
              min={-95}
              max={100}
              step={1}
              value={priceShockPct}
              onChange={(e) => setPriceShockPct(Number(e.target.value))}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
              <span>-95% (Crash)</span>
              <span>0% (Neutral)</span>
              <span>+100% (Doubled)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Capital Re-Allocation (₹ Cash Delta)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs">
                ₹
              </div>
              <input
                type="number"
                step="5000"
                value={customInvestmentDelta || ''}
                placeholder="0 (e.g. +50000 or -20000)"
                onChange={(e) => setCustomInvestmentDelta(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-8 pr-4 font-mono text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Positive injects fresh liquidity proportionally across current holdings; negative simulates cash withdrawal.
            </p>
          </div>
        </div>
      </div>

      {/* Cash Warning Banner if any */}
      {simulation.cashWarning && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-4 text-xs text-rose-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-rose-300">CASH DEFICIT WARNING:</span>
            <p className="mt-0.5">{simulation.cashWarning}</p>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 tabular-nums">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Total Portfolio Value</span>
          <div className="mt-2">
            <span className="font-mono text-xs text-slate-500 line-through">
              {formatINR(simulation.currentTotalEquity)}
            </span>
            <div className="font-mono text-xl font-bold text-white mt-0.5">
              {formatINR(simulation.simulatedTotalEquity)}
            </div>
            <div
              className={`mt-1 flex items-center gap-1 font-mono text-xs font-semibold ${
                deltaEquity >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {deltaEquity >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{deltaEquity >= 0 ? `+${formatINR(deltaEquity)}` : formatINR(deltaEquity)}</span>
              <span>({formatPct(deltaPct)})</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Holdings Market Value</span>
          <div className="mt-2">
            <span className="font-mono text-xs text-slate-500 line-through">
              {formatINR(simulation.currentPortfolioValue)}
            </span>
            <div className="font-mono text-xl font-bold text-cyan-300 mt-0.5">
              {formatINR(simulation.simulatedPortfolioValue)}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">
              {priceShockPct > 0 ? `+${priceShockPct}%` : `${priceShockPct}%`} applied
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Available Cash</span>
          <div className="mt-2">
            <span className="font-mono text-xs text-slate-500 line-through">
              {formatINR(simulation.currentVirtualCash)}
            </span>
            <div className={`font-mono text-xl font-bold mt-0.5 ${simulation.simulatedVirtualCash < 0 ? 'text-rose-400' : 'text-white'}`}>
              {formatINR(simulation.simulatedVirtualCash)}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">
              Delta: {customInvestmentDelta >= 0 ? `+₹${customInvestmentDelta}` : `-₹${Math.abs(customInvestmentDelta)}`}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Simulated Equity Change</span>
          <div className="mt-2">
            <div
              className={`font-mono text-2xl font-bold ${
                simulation.percentageChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPct(simulation.percentageChange)}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">
              {deltaEquity >= 0 ? `+${formatINR(deltaEquity)}` : formatINR(deltaEquity)}
            </div>
          </div>
        </div>
      </div>

      {/* Position Sensitivity Breakdown Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm">
        <h4 className="text-sm font-bold text-white mb-4">Position Sensitivity Breakdown</h4>
        {simulation.positionsBreakdown.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No active positions in the current portfolio to simulate.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold uppercase tracking-wider text-[11px]">Symbol</th>
                  <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider text-[11px]">Quantity</th>
                  <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider text-[11px]">Original Value</th>
                  <th className="py-2.5 px-4 text-right font-semibold uppercase tracking-wider text-[11px]">Simulated Value</th>
                  <th className="py-2.5 pl-4 text-right font-semibold uppercase tracking-wider text-[11px]">Shock Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {simulation.positionsBreakdown.map((pos) => {
                  const delta = pos.pnlDelta;
                  return (
                    <tr key={pos.symbol} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4 font-mono font-bold text-white">{pos.symbol}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{pos.currentQuantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">{formatINR(pos.currentMarketValue)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-cyan-300">
                        {formatINR(pos.simulatedMarketValue)}
                      </td>
                      <td
                        className={`py-3 pl-4 text-right font-mono font-bold ${
                          delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {delta >= 0 ? `+${formatINR(delta)}` : formatINR(delta)} ({formatPct(pos.pnlDeltaPct)})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
