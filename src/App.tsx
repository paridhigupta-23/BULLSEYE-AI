import React, { useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext.tsx';
import { api } from './services/api.ts';
import type { StockSummary } from './types/index.ts';
import { AiAssistant } from './components/AiAssistant.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { BrokerPortal } from './components/BrokerPortal.tsx';
import { InvestorPortal } from './components/InvestorPortal.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { Navbar } from './components/Navbar.tsx';
import { PortalLoginView } from './components/PortalLoginView.tsx';
import { PracticePortal } from './components/PracticePortal.tsx';

const AppShell: React.FC = () => {
  const { portal, user, authChecking, t } = useAppContext();
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [datasetStats, setDatasetStats] = useState<{
    combinedRows: number;
    featureRows: number;
    stocksCount: number;
    dateRange: { start: string; end: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [health, stocksRes] = await Promise.all([api.getHealth(), api.getStocks(0.75)]);
      setDatasetStats({
        combinedRows: health.combinedRows,
        featureRows: health.featureRows,
        stocksCount: health.stocksCount,
        dateRange: health.dateRange,
      });
      setStocks(stocksRes.stocks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to BULLSEYE AI backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const renderProtectedPortal = () => {
    if (portal === 'landing') {
      return <LandingPage stocks={stocks} datasetStats={datasetStats} loading={loading} />;
    }

    if (authChecking) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-slate-600 dark:text-slate-300">
          Verifying portal session...
        </div>
      );
    }

    if (portal === 'investor') {
      if (!user || user.role !== 'Investor') {
        return <PortalLoginView targetPortal="investor" />;
      }
      return <InvestorPortal stocks={stocks} onRefreshStocks={fetchInitialData} />;
    }

    if (portal === 'broker') {
      if (!user || user.role !== 'Broker / Quant') {
        return <PortalLoginView targetPortal="broker" />;
      }
      return <BrokerPortal stocks={stocks} onRefreshStocks={fetchInitialData} />;
    }

    if (portal === 'practice') {
      if (!user || user.role !== 'Practice Trader') {
        return <PortalLoginView targetPortal="practice" />;
      }
      return <PracticePortal stocks={stocks} />;
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] text-slate-900 transition-colors dark:bg-[#111827] dark:text-slate-100">
      <Navbar />

      <main className="pb-24">
        {loadError && (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[#782F46]/40 bg-white p-4 text-sm text-[#782F46] dark:bg-[#1F2937] dark:text-[#B76E85]">
              {loadError}
            </div>
          </div>
        )}

        {renderProtectedPortal()}
      </main>

      <footer className="border-t border-slate-200/80 py-6 pb-20 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>BULLSEYE AI · {t.brandTagline}</span>
          <span>
            Historical NIFTY 50 Dataset (2020–2025) · Role-Protected Quantitative Analytics &amp; Paper Trading
          </span>
        </div>
      </footer>

      <AuthModal />
      <AiAssistant />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
