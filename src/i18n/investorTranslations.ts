import type { LanguageCode } from '../types/index.ts';

export interface InvestorUiDict {
  tabs: {
    home: string;
    ipo: string;
    stocks: string;
    orders: string;
    news: string;
    profile: string;
  };
  common: {
    signOut: string;
    refresh: string;
    loading: string;
    save: string;
    submit: string;
    cancel: string;
    deleteLabel: string;
    close: string;
    send: string;
    symbol: string;
    qty: string;
    price: string;
    action: string;
    status: string;
    notes: string;
    date: string;
    volume: string;
    open: string;
    high: string;
    low: string;
    risk: string;
    sessions: string;
    search: string;
    noData: string;
    historicalCloseLabel: string;
  };
  home: {
    trackedValue: string;
    invested: string;
    unrealizedPnl: string;
    acrossHoldings: string;
    watchlistTitle: string;
    exploreNifty: string;
    recordedOrders: string;
    openOrdersLedger: string;
    primaryEquitiesTitle: string;
    primaryEquitiesSubtitle: string;
    openStocksTerminal: string;
    savedWatchlist: string;
    emptyWatchlist: string;
    holdingsSummary: string;
    addEditHoldings: string;
    noHoldings: string;
    avgBuy: string;
    latestClose: string;
    latestAdviceCardTitle: string;
    pendingRequestsCardTitle: string;
    recentMessagesCardTitle: string;
    viewAllAdvice: string;
    viewAllRequests: string;
    openMessages: string;
    noAdviceYet: string;
    noRequestsYet: string;
    noMessagesYet: string;
    untrained: string;
  };
  stocks: {
    searchPlaceholder: string;
    watchStock: string;
    watchingStock: string;
    clickCardHint: string;
    nseClosePrefix: string;
    latestHistoricalClose: string;
    dailyReturn: string;
    simulateTrade: string;
    bollingerBands: string;
    emaOverlay: string;
    currentRsi: string;
    macdVsSignal: string;
    volRatio: string;
    signalLabel: string;
    thresholdLabel: string;
    riskCategoryLabel: string;
    buyProbLabel: string;
    sellProbLabel: string;
    modelLabel: string;
    featureDateLabel: string;
    latencyLabel: string;
    openBrokerLogin: string;
    untrainedDetail: string;
    modelAttributionTitle: string;
    technicalRulesTitle: string;
    bullish: string;
    bearish: string;
    neutral: string;
    entryPrice: string;
    capital: string;
    riskPct: string;
    atrMult: string;
    targetRR: string;
    stopLoss: string;
    suggestedTarget: string;
    positionSize: string;
    sharesUnit: string;
    capitalAlloc: string;
    riskReward: string;
    atrPctVol: string;
    riskFormulasPrefix: string;
    extFundUnavailable: string;
    extFundNote: string;
    openNewsTab: string;
    garchVolSummary: string;
    nextDayVol: string;
    longRunVol: string;
    investorWatchlist: string;
    savedInSqliteFor: string;
    stocksUnit: string;
    notePlaceholder: string;
    updateNote: string;
    addWatch: string;
    emptyWatchlistHint: string;
    portfolioTracker: string;
    valuedAgainstClose: string;
    marketValue: string;
    avgBuyField: string;
    targetField: string;
    stopLossField: string;
    optional: string;
    saveHoldingBtn: string;
    noTrackedHoldings: string;
    askBrokerTitle: string;
    askBrokerSubtitle: string;
    requestCategoryLabel: string;
    requestQuestionLabel: string;
    requestPlaceholder: string;
    submitRequestBtn: string;
    submittingRequest: string;
    requestSuccess: string;
    categories: {
      stockAnalysis: string;
      recommendation: string;
      portfolioReview: string;
      riskCheck: string;
    };
    presets: string[];
    watchlistAdded: string;
    watchlistRemoved: string;
    holdingSaved: string;
    holdingRemoved: string;
  };
  ipo: {
    title: string;
    subtitle: string;
    refreshBtn: string;
    liveStatusLabel: string;
    connected: string;
    unavailableOffline: string;
    verifiedSource: string;
    snapshotDate: string;
    totalSme: string;
    tableTitle: string;
    shown: string;
    filterPlaceholder: string;
    colCompany: string;
    colPrevClose: string;
    colClose: string;
    colHigh52: string;
    colLow52: string;
    colTradedQty: string;
    statusBannerText: string;
  };
  orders: {
    title: string;
    subtitle: string;
    totalRecords: string;
    newOrderTitle: string;
    niftyStock: string;
    side: string;
    orderType: string;
    marketExecuted: string;
    limitPlanned: string;
    quantity: string;
    priceLabel: string;
    required: string;
    optional: string;
    submitBtn: string;
    savingBtn: string;
    notesPlaceholder: string;
    orderSaved: string;
    colOrderId: string;
    colType: string;
    colTotalValue: string;
    emptyOrders: string;
    closed: string;
  };
  news: {
    title: string;
    subtitle: string;
    refreshBtn: string;
    liveWireLabel: string;
    connected: string;
    unavailableArchive: string;
    sourcesLabel: string;
    allTab: string;
    catAnnouncement: string;
    catBoardMeeting: string;
    catCorporateAction: string;
    searchPlaceholder: string;
    articleNote: string;
    originalTitleLabel: string;
    translatedBadge: string;
    emptyNews: string;
    sourceLabel: string;
  };
  profile: {
    title: string;
    subtitle: string;
    signOutPortal: string;
    investorId: string;
    fullName: string;
    emailAddress: string;
    authorizedRole: string;
    createdTimestamp: string;
    sqliteActivity: string;
    watchlistStocks: string;
    holdingsTracked: string;
    ordersLogged: string;
    totalInvested: string;
    languagePreference: string;
    languageSavedNote: string;
    brokerSectionTitle: string;
    brokerLinkedBadge: string;
    brokerUnlinkedBadge: string;
    brokerCodeLabel: string;
    linkBrokerPlaceholder: string;
    linkBrokerBtn: string;
    brokerLinkedSuccess: string;
    sectionRequests: string;
    sectionAdvice: string;
    sectionMessages: string;
    sectionAccount: string;
  };
  advisory: {
    myRequestsTitle: string;
    myRequestsSubtitle: string;
    askNewQuestionTitle: string;
    noRequests: string;
    brokerResponsesLabel: string;
    expertAdviceTitle: string;
    expertAdviceSubtitle: string;
    noAdvice: string;
    markAsRead: string;
    markedRead: string;
    recommendationLabel: string;
    supportingIndicators: string;
    riskLevelLabel: string;
    messagesTitle: string;
    messagesSubtitle: string;
    noMessages: string;
    messagePlaceholder: string;
    sendMessageBtn: string;
    linkBrokerFirst: string;
    youLabel: string;
    brokerLabel: string;
  };
  statuses: Record<string, string>;
  chart: {
    priceVolume: string;
    rsiLabel: string;
    macdLabel: string;
    signalLabel: string;
    impactLabel: string;
    noOhlcv: string;
    legendUp: string;
    legendDown: string;
  };
}

export const INVESTOR_UI_DICT: Record<LanguageCode, InvestorUiDict> = {
  en: {
    tabs: {
      home: 'Home',
      ipo: 'IPO',
      stocks: 'Stocks',
      orders: 'My Orders',
      news: 'News',
      profile: 'Profile & Advisor',
    },
    common: {
      signOut: 'Sign Out',
      refresh: 'Refresh',
      loading: 'Loading data...',
      save: 'Save',
      submit: 'Submit',
      cancel: 'Cancel',
      deleteLabel: 'Delete',
      close: 'Close',
      send: 'Send',
      symbol: 'Symbol',
      qty: 'Qty',
      price: 'Price',
      action: 'Action',
      status: 'Status',
      notes: 'Notes',
      date: 'Date',
      volume: 'Volume',
      open: 'Open',
      high: 'High',
      low: 'Low',
      risk: 'Risk',
      sessions: 'sessions',
      search: 'Search',
      noData: 'No data available.',
      historicalCloseLabel: 'Historical Close (through 30 Sep 2025)',
    },
    home: {
      trackedValue: 'Tracked Holdings Market Value',
      invested: 'Invested',
      unrealizedPnl: 'Unrealized P&L',
      acrossHoldings: 'across holdings',
      watchlistTitle: 'SQLite Watchlist',
      exploreNifty: 'Explore all 50 NIFTY stocks',
      recordedOrders: 'Recorded Orders',
      openOrdersLedger: 'Open My Orders ledger',
      primaryEquitiesTitle: 'Primary NIFTY 50 Showcase Equities',
      primaryEquitiesSubtitle:
        'Historical close through 30 September 2025 · Click any stock to inspect charts & AI attribution',
      openStocksTerminal: 'Open Full Stocks Terminal',
      savedWatchlist: 'Saved Watchlist',
      emptyWatchlist: 'Your watchlist is empty. Open Stocks to add any NIFTY 50 symbol.',
      holdingsSummary: 'Long-Term Holdings Summary',
      addEditHoldings: 'Add / Edit Holdings',
      noHoldings: 'No holdings recorded yet.',
      avgBuy: 'Avg Buy',
      latestClose: 'Latest Close',
      latestAdviceCardTitle: 'Latest Broker Expert Advice',
      pendingRequestsCardTitle: 'Your Broker Requests',
      recentMessagesCardTitle: 'Messages with Broker',
      viewAllAdvice: 'Open Expert Advice',
      viewAllRequests: 'View My Requests',
      openMessages: 'Open Messages',
      noAdviceYet: 'No expert advice received from your broker yet.',
      noRequestsYet: 'No requests submitted yet. Ask your broker about any stock.',
      noMessagesYet: 'No messages yet. Start a conversation with your broker.',
      untrained: 'UNTRAINED',
    },
    stocks: {
      searchPlaceholder: 'Search 50 NIFTY stocks...',
      watchStock: 'Watch',
      watchingStock: 'Watching',
      clickCardHint: 'Click any card to load full OHLCV charts & explainable signals',
      nseClosePrefix: 'NSE Historical Dataset Close',
      latestHistoricalClose: 'Latest Historical Close',
      dailyReturn: 'Daily Return',
      simulateTrade: 'Simulate Trade',
      bollingerBands: 'Bollinger Bands',
      emaOverlay: 'EMA 12 & 26',
      currentRsi: 'RSI (14) · Current',
      macdVsSignal: 'MACD vs Signal',
      volRatio: 'Vol Ratio',
      signalLabel: 'Signal',
      thresholdLabel: 'Threshold',
      riskCategoryLabel: 'Risk Category',
      buyProbLabel: 'BUY Probability (Next-Day > 0)',
      sellProbLabel: 'SELL / Non-Positive Probability',
      modelLabel: 'Model',
      featureDateLabel: 'Feature Date',
      latencyLabel: 'Latency',
      openBrokerLogin: 'Open Broker / Quant Login',
      untrainedDetail:
        'No fabricated prediction is shown. Model training is restricted to the Broker / Quant Portal; sign in with Quant credentials to train a model for this stock.',
      modelAttributionTitle: 'Model Attribution Contributions (Positive = Bullish, Negative = Bearish)',
      technicalRulesTitle: 'Technical-Rule Observations (Distinct from ML Attribution)',
      bullish: 'Bullish',
      bearish: 'Bearish',
      neutral: 'Neutral',
      entryPrice: 'Entry Price (₹)',
      capital: 'Capital (₹)',
      riskPct: 'Risk % (Default 1.5)',
      atrMult: 'ATR Mult (k)',
      targetRR: 'Target R:R',
      stopLoss: 'Stop Loss',
      suggestedTarget: 'Suggested Target',
      positionSize: 'Position Size',
      sharesUnit: 'shares',
      capitalAlloc: 'Capital Alloc',
      riskReward: 'Risk / Reward',
      atrPctVol: 'ATR % Vol',
      riskFormulasPrefix: 'Formulas: Stop Loss = Entry − (k × ATR) · Position Size = Floor[(Capital × Risk) / (Entry − Stop Loss)]',
      extFundUnavailable: 'External Fundamentals & Live News Unavailable',
      extFundNote:
        'No external live NSE news wire is connected. View verified PR121126 Corporate Filings under the News tab.',
      openNewsTab: 'Open News Tab',
      garchVolSummary: 'GARCH(1,1) Volatility Summary',
      nextDayVol: 'Next-Day Annualized Vol Forecast',
      longRunVol: 'Long-Run Annualized Vol',
      investorWatchlist: 'Investor Watchlist',
      savedInSqliteFor: 'Saved in SQLite for',
      stocksUnit: 'stocks',
      notePlaceholder: 'Watchlist thesis note...',
      updateNote: 'Update Note',
      addWatch: 'Add Watch',
      emptyWatchlistHint: 'Your watchlist is empty. Select any NIFTY 50 stock and click Watch.',
      portfolioTracker: 'Investor Portfolio Tracker',
      valuedAgainstClose: 'Valued against verified historical close',
      marketValue: 'Market Value',
      avgBuyField: 'Avg Buy (₹)',
      targetField: 'Target (₹)',
      stopLossField: 'Stop Loss (₹)',
      optional: 'Optional',
      saveHoldingBtn: 'Save Holding',
      noTrackedHoldings: 'No tracked investor holdings saved yet.',
      askBrokerTitle: 'Ask Your Broker / Request AI Expert Advice',
      askBrokerSubtitle:
        'Send a structured request directly to your linked Broker / Quant advisor based on this stock and your SQLite portfolio.',
      requestCategoryLabel: 'Request Type',
      requestQuestionLabel: 'Your Question for Broker',
      requestPlaceholder: 'Ask whether to hold, rebalance, or manage ATR stop-loss risk...',
      submitRequestBtn: 'Send Request to Broker',
      submittingRequest: 'Sending...',
      requestSuccess: 'Request saved in SQLite and routed to your linked Broker.',
      categories: {
        stockAnalysis: 'Stock Analysis',
        recommendation: 'Buy / Hold Recommendation',
        portfolioReview: 'Portfolio Review',
        riskCheck: 'Risk & Stop-Loss Check',
      },
      presets: [
        'Should I hold or rebalance this position?',
        'Analyze risk and ATR stop-loss for this stock.',
        'How does ML momentum align with my portfolio?',
      ],
      watchlistAdded: 'Saved to your SQLite Watchlist.',
      watchlistRemoved: 'Removed from your SQLite Watchlist.',
      holdingSaved: 'Saved position to your Investor Portfolio.',
      holdingRemoved: 'Removed from Investor Holdings.',
    },
    ipo: {
      title: 'IPO & NSE SME Emerge Watch',
      subtitle: 'Transparent primary-market feed check paired with verified NSE SME Emerge snapshot data',
      refreshBtn: 'Refresh IPO Feed',
      liveStatusLabel: 'Live Primary IPO Feed Status',
      connected: 'CONNECTED',
      unavailableOffline: 'UNAVAILABLE (OFFLINE SNAPSHOT ONLY)',
      verifiedSource: 'Verified Source',
      snapshotDate: 'Snapshot Date',
      totalSme: 'Total SME Securities',
      tableTitle: 'NSE SME Emerge Exchange Listings',
      shown: 'shown',
      filterPlaceholder: 'Filter SME symbol or company...',
      colCompany: 'Company / Security',
      colPrevClose: 'Prev Close',
      colClose: 'Close Price',
      colHigh52: '52W High',
      colLow52: '52W Low',
      colTradedQty: 'Traded Qty',
      statusBannerText:
        'Live primary-market IPO subscription, GMP, and allotment feeds are unavailable in this offline environment. Showing verified NSE SME Emerge exchange market snapshot (12 Nov 2026).',
    },
    orders: {
      title: 'My Orders — SQLite Investor Order Ledger',
      subtitle: 'Create, review, and cancel persistent Investor portfolio execution & planned limit orders',
      totalRecords: 'total records',
      newOrderTitle: 'Record New Investor Order',
      niftyStock: 'NIFTY Stock',
      side: 'Side',
      orderType: 'Order Type',
      marketExecuted: 'MARKET (Executed)',
      limitPlanned: 'LIMIT (Planned)',
      quantity: 'Quantity',
      priceLabel: 'Price (₹)',
      required: 'Required',
      optional: 'Optional',
      submitBtn: 'Submit Investor Order',
      savingBtn: 'Saving...',
      notesPlaceholder: 'Optional order thesis / rationale note...',
      orderSaved: 'Order saved in SQLite.',
      colOrderId: 'Order ID',
      colType: 'Type',
      colTotalValue: 'Total Value',
      emptyOrders: 'No investor orders saved in SQLite.',
      closed: 'Closed',
    },
    news: {
      title: 'News & NSE Corporate Filings',
      subtitle:
        'Exchange announcements, board meetings, and corporate actions parsed from local NSE PR121126 filings',
      refreshBtn: 'Refresh Filings',
      liveWireLabel: 'Live Financial News Wire',
      connected: 'CONNECTED',
      unavailableArchive: 'UNAVAILABLE (EXCHANGE FILINGS ARCHIVE)',
      sourcesLabel: 'Sources',
      allTab: 'All',
      catAnnouncement: 'Announcement',
      catBoardMeeting: 'Board Meeting',
      catCorporateAction: 'Corporate Action',
      searchPlaceholder: 'Search company or filing...',
      articleNote: 'Headline-only exchange record (full external article not bundled)',
      originalTitleLabel: 'Original English Filing Title',
      translatedBadge: 'Translated',
      emptyNews: 'No corporate filings match your search filter.',
      sourceLabel: 'Source',
    },
    profile: {
      title: 'Investor Account Profile & Advisor Hub',
      subtitle: 'Session verified via SQLite Bearer token (/api/auth/me)',
      signOutPortal: 'Sign Out of Investor Portal',
      investorId: 'Investor User ID',
      fullName: 'Full Name',
      emailAddress: 'Email Address',
      authorizedRole: 'Authorized Portal Role',
      createdTimestamp: 'Account Created Timestamp',
      sqliteActivity: 'SQLite Account Activity',
      watchlistStocks: 'Watchlist Stocks',
      holdingsTracked: 'Portfolio Holdings Tracked',
      ordersLogged: 'Investor Orders Logged',
      totalInvested: 'Total Invested Capital',
      languagePreference: 'Preferred Portal Language',
      languageSavedNote: 'Language preference is saved to your SQLite profile and applied across portals.',
      brokerSectionTitle: 'Assigned Broker / Quant Advisor',
      brokerLinkedBadge: 'Linked & Active',
      brokerUnlinkedBadge: 'Not Linked',
      brokerCodeLabel: 'Broker User ID or Email',
      linkBrokerPlaceholder: 'e.g. BRK-QUANT-01',
      linkBrokerBtn: 'Link Broker',
      brokerLinkedSuccess: 'Broker advisor linked to your Investor account.',
      sectionAccount: 'Account & Broker Link',
      sectionRequests: 'My Requests',
      sectionAdvice: 'Expert Advice Received',
      sectionMessages: 'Messages with Broker',
    },
    advisory: {
      myRequestsTitle: 'My Advisory Requests',
      myRequestsSubtitle: 'Track every stock question and portfolio review request sent to your Broker',
      askNewQuestionTitle: 'Submit New Advisory Request',
      noRequests: 'You have not submitted any broker requests yet.',
      brokerResponsesLabel: 'Broker Response',
      expertAdviceTitle: 'Expert Advice from Your Broker',
      expertAdviceSubtitle: 'AI-supported quantitative assessments grounded in your holdings, indicators, ML signals, and ATR/GARCH risk',
      noAdvice: 'No expert advice has been sent to your account yet.',
      markAsRead: 'Mark as Read',
      markedRead: 'Read',
      recommendationLabel: 'Actionable Recommendation',
      supportingIndicators: 'Supporting Indicators & Portfolio Metrics',
      riskLevelLabel: 'Risk Level',
      messagesTitle: 'Direct Messages with Your Broker',
      messagesSubtitle: 'Persistent two-way SQLite messaging thread with your assigned Broker / Quant advisor',
      noMessages: 'No messages yet. Write a message to your broker below.',
      messagePlaceholder: 'Write a message to your broker...',
      sendMessageBtn: 'Send Message',
      linkBrokerFirst: 'Link a Broker User ID (such as BRK-QUANT-01) in Account Profile first to enable messaging.',
      youLabel: 'You',
      brokerLabel: 'Broker',
    },
    statuses: {
      Pending: 'Pending',
      'Under Review': 'Under Review',
      Responded: 'Responded',
      Closed: 'Closed',
      Draft: 'Draft',
      Sent: 'Sent',
      Read: 'Read',
      EXECUTED: 'EXECUTED',
      PLANNED: 'PLANNED',
      CANCELLED: 'CANCELLED',
      Low: 'Low',
      Moderate: 'Moderate',
      Elevated: 'Elevated',
      High: 'High',
      BUY: 'BUY',
      SELL: 'SELL',
      HOLD: 'HOLD',
    },
    chart: {
      priceVolume: 'Price & Volume',
      rsiLabel: 'RSI (14)',
      macdLabel: 'MACD',
      signalLabel: 'Signal',
      impactLabel: 'Feature Impact',
      noOhlcv: 'No OHLCV data available for this selection.',
      legendUp: 'Bullish Candle',
      legendDown: 'Bearish Candle',
    },
  },
  hi: {
    tabs: {
      home: 'होम',
      ipo: 'आईपीओ (IPO)',
      stocks: 'स्टॉक्स',
      orders: 'मेरे ऑर्डर',
      news: 'समाचार',
      profile: 'प्रोफ़ाइल व सलाहकार',
    },
    common: {
      signOut: 'लॉग आउट',
      refresh: 'रीफ़्रेश करें',
      loading: 'डेटा लोड हो रहा है...',
      save: 'सहेजें',
      submit: 'सबमिट करें',
      cancel: 'रद्द करें',
      deleteLabel: 'हटाएं',
      close: 'बंद करें',
      send: 'भेजें',
      symbol: 'प्रतीक (Symbol)',
      qty: 'मात्रा',
      price: 'मूल्य',
      action: 'कार्रवाई',
      status: 'स्थिति',
      notes: 'नोट्स',
      date: 'तिथि',
      volume: 'वॉल्यूम',
      open: 'ओपन',
      high: 'उच्च (High)',
      low: 'न्यून (Low)',
      risk: 'जोखिम',
      sessions: 'सत्र',
      search: 'खोजें',
      noData: 'कोई डेटा उपलब्ध नहीं है।',
      historicalCloseLabel: 'ऐतिहासिक क्लोज़ (30 सितंबर 2025 तक)',
    },
    home: {
      trackedValue: 'ट्रैक किए गए होल्डिंग्स का बाज़ार मूल्य',
      invested: 'निवेशित राशि',
      unrealizedPnl: 'अनरियलाइज़्ड लाभ/हानि (P&L)',
      acrossHoldings: 'कुल होल्डिंग्स पर',
      watchlistTitle: 'SQLite वॉचलिस्ट',
      exploreNifty: 'सभी 50 NIFTY स्टॉक देखें',
      recordedOrders: 'दर्ज ऑर्डर',
      openOrdersLedger: 'मेरे ऑर्डर बही खोलें',
      primaryEquitiesTitle: 'प्रमुख NIFTY 50 शोकेस इक्विटी',
      primaryEquitiesSubtitle:
        '30 सितंबर 2025 तक का ऐतिहासिक क्लोज़ · चार्ट और AI विश्लेषण देखने के लिए किसी स्टॉक पर क्लिक करें',
      openStocksTerminal: 'पूर्ण स्टॉक्स टर्मिनल खोलें',
      savedWatchlist: 'सहेजी गई वॉचलिस्ट',
      emptyWatchlist: 'आपकी वॉचलिस्ट खाली है। किसी भी NIFTY 50 स्टॉक को जोड़ने के लिए स्टॉक्स खोलें।',
      holdingsSummary: 'दीर्घकालिक होल्डिंग्स सारांश',
      addEditHoldings: 'होल्डिंग जोड़ें / संपादित करें',
      noHoldings: 'अभी कोई होल्डिंग दर्ज नहीं है।',
      avgBuy: 'औसत खरीद',
      latestClose: 'नवीनतम क्लोज़',
      latestAdviceCardTitle: 'नवीनतम ब्रोकर विशेषज्ञ सलाह',
      pendingRequestsCardTitle: 'आपके ब्रोकर अनुरोध',
      recentMessagesCardTitle: 'ब्रोकर के साथ संदेश',
      viewAllAdvice: 'सभी विशेषज्ञ सलाह देखें',
      viewAllRequests: 'मेरे अनुरोध देखें',
      openMessages: 'संदेश खोलें',
      noAdviceYet: 'आपके ब्रोकर से अभी तक कोई विशेषज्ञ सलाह प्राप्त नहीं हुई है।',
      noRequestsYet: 'अभी कोई अनुरोध नहीं भेजा गया है। किसी भी स्टॉक के बारे में ब्रोकर से पूछें।',
      noMessagesYet: 'अभी कोई संदेश नहीं है। अपने ब्रोकर से बातचीत शुरू करें।',
      untrained: 'अप्रशिक्षित',
    },
    stocks: {
      searchPlaceholder: '50 NIFTY स्टॉक खोजें...',
      watchStock: 'वॉचलिस्ट में जोड़ें',
      watchingStock: 'वॉचलिस्ट में है',
      clickCardHint: 'पूर्ण OHLCV चार्ट और व्याख्यात्मक सिग्नल लोड करने के लिए किसी कार्ड पर क्लिक करें',
      nseClosePrefix: 'NSE ऐतिहासिक डेटासेट क्लोज़',
      latestHistoricalClose: 'नवीनतम ऐतिहासिक क्लोज़',
      dailyReturn: 'दैनिक रिटर्न',
      simulateTrade: 'ट्रेड सिम्युलेट करें',
      bollingerBands: 'बोलिंजर बैंड्स',
      emaOverlay: 'EMA 12 और 26',
      currentRsi: 'RSI (14) · वर्तमान',
      macdVsSignal: 'MACD बनाम सिग्नल',
      volRatio: 'वॉल्यूम अनुपात',
      signalLabel: 'सिग्नल',
      thresholdLabel: 'थ्रेशोल्ड',
      riskCategoryLabel: 'जोखिम श्रेणी',
      buyProbLabel: 'BUY संभाव्यता (अगला दिन > 0)',
      sellProbLabel: 'SELL / गैर-सकारात्मक संभाव्यता',
      modelLabel: 'मॉडल',
      featureDateLabel: 'फ़ीचर तिथि',
      latencyLabel: 'लेटेंसी',
      openBrokerLogin: 'ब्रोकर / क्वांट लॉगिन खोलें',
      untrainedDetail:
        'कोई मनगढ़ंत पूर्वानुमान नहीं दिखाया जाता। मॉडल प्रशिक्षण केवल ब्रोकर / क्वांट पोर्टल के लिए सीमित है; इस स्टॉक के लिए मॉडल ट्रेन करने हेतु क्वांट खाते से साइन इन करें।',
      modelAttributionTitle: 'मॉडल योगदान विश्लेषण (सकारात्मक = बुलिश, नकारात्मक = बेयरिश)',
      technicalRulesTitle: 'तकनीकी-नियम अवलोकन (ML योगदान से अलग)',
      bullish: 'बुलिश (तेज़ी)',
      bearish: 'बेयरिश (मंदी)',
      neutral: 'तटस्थ',
      entryPrice: 'प्रवेश मूल्य (₹)',
      capital: 'पूंजी (₹)',
      riskPct: 'जोखिम % (डिफ़ॉल्ट 1.5)',
      atrMult: 'ATR गुणक (k)',
      targetRR: 'लक्ष्य R:R',
      stopLoss: 'स्टॉप लॉस',
      suggestedTarget: 'सुझावित लक्ष्य',
      positionSize: 'पोजीशन साइज़',
      sharesUnit: 'शेयर',
      capitalAlloc: 'पूंजी आवंटन',
      riskReward: 'जोखिम / प्रतिफल',
      atrPctVol: 'ATR % अस्थिरता',
      riskFormulasPrefix: 'फ़ॉर्मूला: स्टॉप लॉस = प्रवेश − (k × ATR) · पोजीशन साइज़ = Floor[(पूंजी × जोखिम) / (प्रवेश − स्टॉप लॉस)]',
      extFundUnavailable: 'बाहरी फंडामेंटल्स और लाइव समाचार अनुपलब्ध',
      extFundNote:
        'कोई बाहरी लाइव NSE न्यूज़ वायर जुड़ा नहीं है। सत्यापित PR121126 कॉर्पोरेट फाइलिंग समाचार टैब में देखें।',
      openNewsTab: 'समाचार टैब खोलें',
      garchVolSummary: 'GARCH(1,1) वोलैटिलिटी सारांश',
      nextDayVol: 'अगले दिन का वार्षिक वोलैटिलिटी अनुमान',
      longRunVol: 'दीर्घकालिक वार्षिक वोलैटिलिटी',
      investorWatchlist: 'निवेशक वॉचलिस्ट',
      savedInSqliteFor: 'SQLite में सहेजा गया:',
      stocksUnit: 'स्टॉक',
      notePlaceholder: 'वॉचलिस्ट नोट लिखें...',
      updateNote: 'नोट अपडेट करें',
      addWatch: 'वॉचलिस्ट में जोड़ें',
      emptyWatchlistHint: 'आपकी वॉचलिस्ट खाली है। किसी भी NIFTY 50 स्टॉक को चुनकर जोड़ें।',
      portfolioTracker: 'निवेशक पोर्टफोलियो ट्रैकर',
      valuedAgainstClose: 'सत्यापित ऐतिहासिक क्लोज़ के आधार पर मूल्यांकित',
      marketValue: 'बाज़ार मूल्य',
      avgBuyField: 'औसत खरीद (₹)',
      targetField: 'लक्ष्य (₹)',
      stopLossField: 'स्टॉप लॉस (₹)',
      optional: 'वैकल्पिक',
      saveHoldingBtn: 'होल्डिंग सहेजें',
      noTrackedHoldings: 'अभी कोई ट्रैक की गई होल्डिंग सहेजी नहीं गई है।',
      askBrokerTitle: 'अपने ब्रोकर से पूछें / AI विशेषज्ञ सलाह मांगें',
      askBrokerSubtitle:
        'इस स्टॉक और आपके SQLite पोर्टफोलियो के आधार पर अपने जुड़े ब्रोकर / क्वांट सलाहकार को अनुरोध भेजें।',
      requestCategoryLabel: 'अनुरोध का प्रकार',
      requestQuestionLabel: 'ब्रोकर से आपका प्रश्न',
      requestPlaceholder: 'पूछें कि होल्ड करें, रीबैलेंस करें या ATR स्टॉप-लॉस जोखिम कैसे संभालें...',
      submitRequestBtn: 'ब्रोकर को अनुरोध भेजें',
      submittingRequest: 'भेजा जा रहा है...',
      requestSuccess: 'अनुरोध SQLite में सहेजा गया और आपके जुड़े ब्रोकर को भेज दिया गया है।',
      categories: {
        stockAnalysis: 'स्टॉक विश्लेषण',
        recommendation: 'खरीद / होल्ड सिफारिश',
        portfolioReview: 'पोर्टफोलियो समीक्षा',
        riskCheck: 'जोखिम व स्टॉप-लॉस जांच',
      },
      presets: [
        'क्या मुझे इस पोजीशन को होल्ड करना चाहिए या रीबैलेंस करना चाहिए?',
        'इस स्टॉक के लिए जोखिम और ATR स्टॉप-लॉस का विश्लेषण करें।',
        'मेरे पोर्टफोलियो के साथ ML मोमेंटम कैसे मेल खाता है?',
      ],
      watchlistAdded: 'आपकी SQLite वॉचलिस्ट में सहेजा गया।',
      watchlistRemoved: 'आपकी SQLite वॉचलिस्ट से हटाया गया।',
      holdingSaved: 'निवेशक पोर्टफोलियो में पोजीशन सहेजी गई।',
      holdingRemoved: 'निवेशक होल्डिंग्स से हटाया गया।',
    },
    ipo: {
      title: 'IPO और NSE SME Emerge वॉच',
      subtitle: 'सत्यापित NSE SME Emerge स्नैपशॉट डेटा के साथ पारदर्शी प्राइमरी मार्केट जांच',
      refreshBtn: 'IPO फ़ीड रीफ़्रेश करें',
      liveStatusLabel: 'लाइव प्राइमरी IPO फ़ीड स्थिति',
      connected: 'कनेक्टेड',
      unavailableOffline: 'अनुपलब्ध (केवल ऑफ़लाइन स्नैपशॉट)',
      verifiedSource: 'सत्यापित स्रोत',
      snapshotDate: 'स्नैपशॉट तिथि',
      totalSme: 'कुल SME प्रतिभूतियाँ',
      tableTitle: 'NSE SME Emerge एक्सचेंज लिस्टिंग',
      shown: 'दिखाए गए',
      filterPlaceholder: 'SME प्रतीक या कंपनी खोजें...',
      colCompany: 'कंपनी / सिक्योरिटी',
      colPrevClose: 'पिछला क्लोज़',
      colClose: 'क्लोज़ मूल्य',
      colHigh52: '52-सप्ताह उच्च',
      colLow52: '52-सप्ताह निम्न',
      colTradedQty: 'ट्रेडेड मात्रा',
      statusBannerText:
        'इस ऑफ़लाइन वातावरण में लाइव IPO सब्सक्रिप्शन, GMP और अलॉटमेंट फ़ीड उपलब्ध नहीं हैं। सत्यापित NSE SME Emerge स्नैपशॉट (12 नवम्बर 2026) दिखाया जा रहा है।',
    },
    orders: {
      title: 'मेरे ऑर्डर — SQLite निवेशक ऑर्डर बही',
      subtitle: 'स्थायी निवेशक निष्पादन और नियोजित लिमिट ऑर्डर बनाएं, समीक्षा करें और रद्द करें',
      totalRecords: 'कुल रिकॉर्ड',
      newOrderTitle: 'नया निवेशक ऑर्डर दर्ज करें',
      niftyStock: 'NIFTY स्टॉक',
      side: 'पक्ष (Side)',
      orderType: 'ऑर्डर प्रकार',
      marketExecuted: 'MARKET (निष्पादित)',
      limitPlanned: 'LIMIT (नियोजित)',
      quantity: 'मात्रा',
      priceLabel: 'मूल्य (₹)',
      required: 'अनिवार्य',
      optional: 'वैकल्पिक',
      submitBtn: 'निवेशक ऑर्डर सबमिट करें',
      savingBtn: 'सहेजा जा रहा है...',
      notesPlaceholder: 'वैकल्पिक ऑर्डर कारण या नोट लिखें...',
      orderSaved: 'ऑर्डर SQLite में सहेजा गया।',
      colOrderId: 'ऑर्डर आईडी',
      colType: 'प्रकार',
      colTotalValue: 'कुल मूल्य',
      emptyOrders: 'SQLite में कोई निवेशक ऑर्डर सहेजा नहीं गया है।',
      closed: 'बंद',
    },
    news: {
      title: 'समाचार एवं NSE कॉर्पोरेट फाइलिंग',
      subtitle:
        'स्थानीय NSE PR121126 एक्सचेंज फाइलिंग से प्राप्त कॉर्पोरेट घोषणाएँ, बोर्ड बैठकें और कॉर्पोरेट कार्रवाइयाँ',
      refreshBtn: 'फाइलिंग रीफ़्रेश करें',
      liveWireLabel: 'लाइव वित्तीय समाचार वायर',
      connected: 'कनेक्टेड',
      unavailableArchive: 'अनुपलब्ध (एक्सचेंज फाइलिंग संग्रह)',
      sourcesLabel: 'स्रोत फ़ाइलें',
      allTab: 'सभी',
      catAnnouncement: 'घोषणा',
      catBoardMeeting: 'बोर्ड बैठक',
      catCorporateAction: 'कॉर्पोरेट कार्रवाई',
      searchPlaceholder: 'कंपनी या फाइलिंग खोजें...',
      articleNote: 'केवल एक्सचेंज घोषणा शीर्षक उपलब्ध (पूर्ण बाहरी लेख संलग्न नहीं)',
      originalTitleLabel: 'मूल अंग्रेज़ी शीर्षक',
      translatedBadge: 'अनुवादित',
      emptyNews: 'आपकी खोज से मेल खाने वाली कोई कॉर्पोरेट फाइलिंग नहीं मिली।',
      sourceLabel: 'स्रोत',
    },
    profile: {
      title: 'निवेशक प्रोफ़ाइल एवं सलाहकार केंद्र',
      subtitle: 'SQLite बियरर टोकन के माध्यम से सत्यापित सत्र (/api/auth/me)',
      signOutPortal: 'निवेशक पोर्टल से लॉग आउट करें',
      investorId: 'निवेशक यूज़र आईडी',
      fullName: 'पूरा नाम',
      emailAddress: 'ईमेल पता',
      authorizedRole: 'अधिकृत पोर्टल भूमिका',
      createdTimestamp: 'खाता निर्माण समय',
      sqliteActivity: 'SQLite खाता गतिविधि',
      watchlistStocks: 'वॉचलिस्ट स्टॉक',
      holdingsTracked: 'ट्रैक किए गए होल्डिंग्स',
      ordersLogged: 'दर्ज निवेशक ऑर्डर',
      totalInvested: 'कुल निवेशित पूंजी',
      languagePreference: 'पसंदीदा पोर्टल भाषा',
      languageSavedNote: 'आपकी भाषा प्राथमिकता SQLite प्रोफ़ाइल में सहेजी जाती है और लॉगिन के बाद भी बनी रहती है।',
      brokerSectionTitle: 'नियुक्त ब्रोकर / क्वांट सलाहकार',
      brokerLinkedBadge: 'लिंक्ड और सक्रिय',
      brokerUnlinkedBadge: 'लिंक नहीं है',
      brokerCodeLabel: 'ब्रोकर यूज़र आईडी या ईमेल',
      linkBrokerPlaceholder: 'उदा. BRK-QUANT-01',
      linkBrokerBtn: 'ब्रोकर लिंक करें',
      brokerLinkedSuccess: 'ब्रोकर सलाहकार आपके निवेशक खाते से लिंक हो गया है।',
      sectionAccount: 'खाता व ब्रोकर लिंक',
      sectionRequests: 'मेरे अनुरोध',
      sectionAdvice: 'प्राप्त विशेषज्ञ सलाह',
      sectionMessages: 'ब्रोकर से संदेश',
    },
    advisory: {
      myRequestsTitle: 'मेरे सलाहकार अनुरोध',
      myRequestsSubtitle: 'अपने ब्रोकर को भेजे गए प्रत्येक स्टॉक प्रश्न और पोर्टफोलियो समीक्षा की स्थिति देखें',
      askNewQuestionTitle: 'नया सलाहकार अनुरोध भेजें',
      noRequests: 'आपने अभी तक ब्रोकर को कोई अनुरोध नहीं भेजा है।',
      brokerResponsesLabel: 'ब्रोकर उत्तर',
      expertAdviceTitle: 'आपके ब्रोकर से विशेषज्ञ सलाह',
      expertAdviceSubtitle: 'आपके होल्डिंग्स, तकनीकी इंडिकेटर, ML सिग्नल और ATR/GARCH जोखिम पर आधारित AI विश्लेषण',
      noAdvice: 'आपके खाते में अभी तक कोई विशेषज्ञ सलाह नहीं भेजी गई है।',
      markAsRead: 'पढ़ा हुआ चिह्नित करें',
      markedRead: 'पढ़ा गया',
      recommendationLabel: 'कार्रवाई योग्य सिफारिश',
      supportingIndicators: 'सहायक इंडिकेटर और पोर्टफोलियो आंकड़े',
      riskLevelLabel: 'जोखिम स्तर',
      messagesTitle: 'अपने ब्रोकर से सीधे संदेश',
      messagesSubtitle: 'आपके नियुक्त ब्रोकर / क्वांट सलाहकार के साथ स्थायी दो-तरफ़ा SQLite संदेश संवाद',
      noMessages: 'अभी कोई संदेश नहीं है। नीचे अपने ब्रोकर को संदेश लिखें।',
      messagePlaceholder: 'अपने ब्रोकर को संदेश लिखें...',
      sendMessageBtn: 'संदेश भेजें',
      linkBrokerFirst: 'संदेश सेवा शुरू करने के लिए पहले प्रोफ़ाइल में ब्रोकर आईडी (जैसे BRK-QUANT-01) लिंक करें।',
      youLabel: 'आप',
      brokerLabel: 'ब्रोकर',
    },
    statuses: {
      Pending: 'लंबित',
      'Under Review': 'समीक्षाधीन',
      Responded: 'उत्तर दिया गया',
      Closed: 'बंद',
      Draft: 'ड्राफ्ट',
      Sent: 'भेजा गया',
      Read: 'पढ़ा गया',
      EXECUTED: 'निष्पादित',
      PLANNED: 'नियोजित',
      CANCELLED: 'रद्द',
      Low: 'कम',
      Moderate: 'मध्यम',
      Elevated: 'उच्चतर',
      High: 'उच्च',
      BUY: 'खरीदें (BUY)',
      SELL: 'बेचें (SELL)',
      HOLD: 'होल्ड (HOLD)',
    },
    chart: {
      priceVolume: 'मूल्य और वॉल्यूम',
      rsiLabel: 'RSI (14)',
      macdLabel: 'MACD',
      signalLabel: 'सिग्नल',
      impactLabel: 'फ़ीचर प्रभाव',
      noOhlcv: 'इस चयन के लिए कोई OHLCV डेटा उपलब्ध नहीं है।',
      legendUp: 'तेज़ी कैंडल',
      legendDown: 'मंदी कैंडल',
    },
  },
  te: {
    tabs: {
      home: 'హోమ్',
      ipo: 'ఐపీఓ (IPO)',
      stocks: 'స్టాక్స్',
      orders: 'నా ఆర్డర్లు',
      news: 'వార్తలు',
      profile: 'ప్రొఫైల్ & సలహాదారు',
    },
    common: {
      signOut: 'సైన్ అవుట్',
      refresh: 'రిఫ్రెష్',
      loading: 'డేటా లోడ్ అవుతోంది...',
      save: 'సేవ్ చేయండి',
      submit: 'సమర్పించండి',
      cancel: 'రద్దు చేయండి',
      deleteLabel: 'తొలగించండి',
      close: 'మూసివేయండి',
      send: 'పంపండి',
      symbol: 'చిహ్నం (Symbol)',
      qty: 'పరిమాణం',
      price: 'ధర',
      action: 'చర్య',
      status: 'స్థితి',
      notes: 'గమనికలు',
      date: 'తేదీ',
      volume: 'వాల్యూమ్',
      open: 'ఓపెన్',
      high: 'గరిష్టం (High)',
      low: 'కనిష్టం (Low)',
      risk: 'రిస్క్',
      sessions: 'సెషన్లు',
      search: 'వెతకండి',
      noData: 'డేటా అందుబాటులో లేదు.',
      historicalCloseLabel: 'చారిత్రక ముగింపు (30 సెప్టెంబర్ 2025 వరకు)',
    },
    home: {
      trackedValue: 'ట్రాక్ చేయబడిన హోల్డింగ్స్ మార్కెట్ విలువ',
      invested: 'పెట్టుబడి',
      unrealizedPnl: 'అన్‌రియలైజ్డ్ లాభం/నష్టం (P&L)',
      acrossHoldings: 'హోల్డింగ్స్‌పై మొత్తం',
      watchlistTitle: 'SQLite వాచ్‌లిస్ట్',
      exploreNifty: 'మొత్తం 50 NIFTY స్టాక్స్ చూడండి',
      recordedOrders: 'నమోదైన ఆర్డర్లు',
      openOrdersLedger: 'నా ఆర్డర్ల పట్టిక తెరవండి',
      primaryEquitiesTitle: 'ప్రధాన NIFTY 50 షోకేస్ స్టాక్స్',
      primaryEquitiesSubtitle:
        '30 సెప్టెంబర్ 2025 వరకు చారిత్రక ముగింపు ధర · చార్టులు & AI విశ్లేషణ కోసం స్టాక్‌పై క్లిక్ చేయండి',
      openStocksTerminal: 'పూర్తి స్టాక్స్ టెర్మినల్ తెరవండి',
      savedWatchlist: 'సేవ్ చేసిన వాచ్‌లిస్ట్',
      emptyWatchlist: 'మీ వాచ్‌లిస్ట్ ఖాళీగా ఉంది. NIFTY 50 స్టాక్ జోడించడానికి స్టాక్స్ తెరవండి.',
      holdingsSummary: 'దీర్ఘకాలిక హోల్డింగ్స్ సారాంశం',
      addEditHoldings: 'హోల్డింగ్స్ జోడించండి / మార్చండి',
      noHoldings: 'ఇంకా హోల్డింగ్స్ నమోదు కాలేదు.',
      avgBuy: 'సగటు కొనుగోలు',
      latestClose: 'తాజా ముగింపు',
      latestAdviceCardTitle: 'తాజా బ్రోకర్ నిపుణుల సలహా',
      pendingRequestsCardTitle: 'మీ బ్రోకర్ అభ్యర్థనలు',
      recentMessagesCardTitle: 'బ్రోకర్‌తో సందేశాలు',
      viewAllAdvice: 'అన్ని నిపుణుల సలహాలు చూడండి',
      viewAllRequests: 'నా అభ్యర్థనలు చూడండి',
      openMessages: 'సందేశాలు తెరవండి',
      noAdviceYet: 'మీ బ్రోకర్ నుండి ఇంకా నిపుణుల సలహా అందలేదు.',
      noRequestsYet: 'ఇంకా అభ్యర్థనలు సమర్పించబడలేదు. ఏదైనా స్టాక్ గురించి మీ బ్రోకర్‌ను అడగండి.',
      noMessagesYet: 'ఇంకా సందేశాలు లేవు. మీ బ్రోకర్‌తో సంభాషణ ప్రారంభించండి.',
      untrained: 'ట్రైన్ కాలేదు',
    },
    stocks: {
      searchPlaceholder: '50 NIFTY స్టాక్స్ వెతకండి...',
      watchStock: 'వాచ్‌లిస్ట్‌లో చేర్చు',
      watchingStock: 'వాచ్‌లిస్ట్‌లో ఉంది',
      clickCardHint: 'పూర్తి OHLCV చార్టులు & AI సిగ్నల్స్ చూడటానికి ఏదైనా కార్డుపై క్లిక్ చేయండి',
      nseClosePrefix: 'NSE చారిత్రక డేటాసెట్ ముగింపు',
      latestHistoricalClose: 'తాజా చారిత్రక ముగింపు',
      dailyReturn: 'రోజువారీ రాబడి',
      simulateTrade: 'ట్రేడ్ సిమ్యులేట్ చేయండి',
      bollingerBands: 'బోలింగర్ బ్యాండ్స్',
      emaOverlay: 'EMA 12 & 26',
      currentRsi: 'RSI (14) · ప్రస్తుత విలువ',
      macdVsSignal: 'MACD vs సిగ్నల్',
      volRatio: 'వాల్యూమ్ నిష్పత్తి',
      signalLabel: 'సిగ్నల్',
      thresholdLabel: 'థ్రెషోల్డ్',
      riskCategoryLabel: 'రిస్క్ వర్గం',
      buyProbLabel: 'BUY సంభావ్యత (తదుపరి రోజు > 0)',
      sellProbLabel: 'SELL / ప్రతికూల సంభావ్యత',
      modelLabel: 'మోడల్',
      featureDateLabel: 'ఫీచర్ తేదీ',
      latencyLabel: 'లేటెన్సీ',
      openBrokerLogin: 'బ్రోకర్ / క్వాంట్ లాగిన్ తెరవండి',
      untrainedDetail:
        'కల్పిత అంచనా చూపబడదు. మోడల్ ట్రైనింగ్ బ్రోకర్ / క్వాంట్ పోర్టల్‌కు మాత్రమే పరిమితం చేయబడింది; ఈ స్టాక్ కోసం మోడల్ ట్రైన్ చేయడానికి క్వాంట్ ఖాతాతో సైన్ ఇన్ చేయండి.',
      modelAttributionTitle: 'మోడల్ ఫీచర్ సహకారం (సానుకూలం = బుల్లిష్, ప్రతికూలం = బేరిష్)',
      technicalRulesTitle: 'సాంకేతిక నియమ పరిశీలనలు (ML ప్రభావం నుండి వేరు)',
      bullish: 'బుల్లిష్ (పెరుగుదల)',
      bearish: 'బేరిష్ (తగ్గుదల)',
      neutral: 'తటస్థం',
      entryPrice: 'ఎంట్రీ ధర (₹)',
      capital: 'పెట్టుబడి మూలధనం (₹)',
      riskPct: 'రిస్క్ % (డిఫాల్ట్ 1.5)',
      atrMult: 'ATR గుణకం (k)',
      targetRR: 'లక్ష్యం R:R',
      stopLoss: 'స్టాప్ లాస్',
      suggestedTarget: 'సూచించిన లక్ష్యం',
      positionSize: 'పొజిషన్ సైజ్',
      sharesUnit: 'షేర్లు',
      capitalAlloc: 'మూలధన కేటాయింపు',
      riskReward: 'రిస్క్ / రివార్డ్',
      atrPctVol: 'ATR % అస్థిరత',
      riskFormulasPrefix: 'సూత్రాలు: స్టాప్ లాస్ = ఎంట్రీ − (k × ATR) · పొజిషన్ సైజ్ = Floor[(మూలధనం × రిస్క్) / (ఎంట్రీ − స్టాప్ లాస్)]',
      extFundUnavailable: 'బాహ్య ఫండమెంటల్స్ & లైవ్ వార్తలు అందుబాటులో లేవు',
      extFundNote:
        'బాహ్య లైవ్ NSE వార్తా ఫీడ్ కనెక్ట్ చేయబడలేదు. ధృవీకరించబడిన PR121126 ఫైలింగ్స్‌ను వార్తలు ట్యాబ్‌లో చూడండి.',
      openNewsTab: 'వార్తలు ట్యాబ్ తెరవండి',
      garchVolSummary: 'GARCH(1,1) అస్థిరత సారాంశం',
      nextDayVol: 'తదుపరి రోజు వార్షిక అస్థిరత అంచనా',
      longRunVol: 'దీర్ఘకాలిక వార్షిక అస్థిరత',
      investorWatchlist: 'ఇన్వెస్టర్ వాచ్‌లిస్ట్',
      savedInSqliteFor: 'SQLite లో సేవ్ చేయబడింది:',
      stocksUnit: 'స్టాక్స్',
      notePlaceholder: 'వాచ్‌లిస్ట్ గమనిక వ్రాయండి...',
      updateNote: 'గమనిక అప్‌డేట్ చేయండి',
      addWatch: 'వాచ్‌లిస్ట్‌లో చేర్చు',
      emptyWatchlistHint: 'మీ వాచ్‌లిస్ట్ ఖాళీగా ఉంది. ఏదైనా NIFTY 50 స్టాక్‌ను ఎంచుకుని జోడించండి.',
      portfolioTracker: 'ఇన్వెస్టర్ పోర్ట్‌ఫోలియో ట్రాకర్',
      valuedAgainstClose: 'ధృవీకరించబడిన చారిత్రక ముగింపు ఆధారంగా విలువ',
      marketValue: 'మార్కెట్ విలువ',
      avgBuyField: 'సగటు కొనుగోలు (₹)',
      targetField: 'లక్ష్యం (₹)',
      stopLossField: 'స్టాప్ లాస్ (₹)',
      optional: 'ఐచ్ఛికం',
      saveHoldingBtn: 'హోల్డింగ్ సేవ్ చేయండి',
      noTrackedHoldings: 'ఇంకా ఇన్వెస్టర్ హోల్డింగ్స్ సేవ్ చేయబడలేదు.',
      askBrokerTitle: 'మీ బ్రోకర్‌ను అడగండి / AI నిపుణుల సలహా కోరండి',
      askBrokerSubtitle:
        'ఈ స్టాక్ మరియు మీ SQLite పోర్ట్‌ఫోలియో ఆధారంగా మీ లింక్ చేయబడిన బ్రోకర్ / క్వాంట్ సలహాదారుకు అభ్యర్థన పంపండి.',
      requestCategoryLabel: 'అభ్యర్థన రకం',
      requestQuestionLabel: 'బ్రోకర్‌కు మీ ప్రశ్న',
      requestPlaceholder: 'హోల్డ్ చేయాలా, రీబ్యాలెన్స్ చేయాలా లేదా ATR స్టాప్-లాస్ రిస్క్ ఎలా నియంత్రించాలో అడగండి...',
      submitRequestBtn: 'బ్రోకర్‌కు అభ్యర్థన పంపండి',
      submittingRequest: 'పంపుతోంది...',
      requestSuccess: 'అభ్యర్థన SQLite లో సేవ్ చేయబడింది మరియు మీ బ్రోకర్‌కు పంపబడింది.',
      categories: {
        stockAnalysis: 'స్టాక్ విశ్లేషణ',
        recommendation: 'కొనుగోలు / హోల్డ్ సిఫార్సు',
        portfolioReview: 'పోర్ట్‌ఫోలియో సమీక్ష',
        riskCheck: 'రిస్క్ & స్టాప్-లాస్ తనిఖీ',
      },
      presets: [
        'నేను ఈ పొజిషన్‌ను హోల్డ్ చేయాలా లేదా రీబ్యాలెన్స్ చేయాలా?',
        'ఈ స్టాక్ కోసం రిస్క్ మరియు ATR స్టాప్-లాస్ విశ్లేషించండి.',
        'నా పోర్ట్‌ఫోలియోతో ML మొమెంటం ఎలా సరిపోతుంది?',
      ],
      watchlistAdded: 'మీ SQLite వాచ్‌లిస్ట్‌లో సేవ్ చేయబడింది.',
      watchlistRemoved: 'మీ SQLite వాచ్‌లిస్ట్ నుండి తొలగించబడింది.',
      holdingSaved: 'ఇన్వెస్టర్ పోర్ట్‌ఫోలియోలో పొజిషన్ సేవ్ చేయబడింది.',
      holdingRemoved: 'ఇన్వెస్టర్ హోల్డింగ్స్ నుండి తొలగించబడింది.',
    },
    ipo: {
      title: 'IPO & NSE SME Emerge వాచ్',
      subtitle: 'ధృవీకరించబడిన NSE SME Emerge స్నాప్‌షాట్ డేటాతో ప్రైమరీ మార్కెట్ తనిఖీ',
      refreshBtn: 'IPO ఫీడ్ రిఫ్రెష్ చేయండి',
      liveStatusLabel: 'లైవ్ ప్రైమరీ IPO ఫీడ్ స్థితి',
      connected: 'కనెక్ట్ అయింది',
      unavailableOffline: 'అందుబాటులో లేదు (ఆఫ్‌లైన్ స్నాప్‌షాట్ మాత్రమే)',
      verifiedSource: 'ధృవీకరించబడిన మూలం',
      snapshotDate: 'స్నాప్‌షాట్ తేదీ',
      totalSme: 'మొత్తం SME సెక్యూరిటీలు',
      tableTitle: 'NSE SME Emerge ఎక్స్ఛేంజ్ లిస్టింగ్స్',
      shown: 'చూపబడ్డాయి',
      filterPlaceholder: 'SME చిహ్నం లేదా కంపెనీ వెతకండి...',
      colCompany: 'కంపెనీ / సెక్యూరిటీ',
      colPrevClose: 'గత ముగింపు',
      colClose: 'ముగింపు ధర',
      colHigh52: '52-వారాల గరిష్టం',
      colLow52: '52-వారాల కనిష్టం',
      colTradedQty: 'ట్రేడెడ్ పరిమాణం',
      statusBannerText:
        'ఈ ఆఫ్‌లైన్ వాతావరణంలో లైవ్ IPO సబ్‌స్క్రిప్షన్, GMP మరియు అలాట్‌మెంట్ ఫీడ్స్ అందుబాటులో లేవు. ధృవీకరించబడిన NSE SME Emerge స్నాప్‌షాట్ (12 నవంబర్ 2026) చూపబడుతోంది.',
    },
    orders: {
      title: 'నా ఆర్డర్లు — SQLite ఇన్వెస్టర్ ఆర్డర్ పట్టిక',
      subtitle: 'శాశ్వత ఇన్వెస్టర్ ఎగ్జిక్యూషన్ మరియు ప్లాన్ చేసిన లిమిట్ ఆర్డర్లను రూపొందించండి, సమీక్షించండి మరియు రద్దు చేయండి',
      totalRecords: 'మొత్తం రికార్డులు',
      newOrderTitle: 'కొత్త ఇన్వెస్టర్ ఆర్డర్ నమోదు చేయండి',
      niftyStock: 'NIFTY స్టాక్',
      side: 'వైపు (Side)',
      orderType: 'ఆర్డర్ రకం',
      marketExecuted: 'MARKET (పూర్తయినది)',
      limitPlanned: 'LIMIT (ప్లాన్ చేయబడింది)',
      quantity: 'పరిమాణం',
      priceLabel: 'ధర (₹)',
      required: 'తప్పనిసరి',
      optional: 'ఐచ్ఛికం',
      submitBtn: 'ఇన్వెస్టర్ ఆర్డర్ సమర్పించండి',
      savingBtn: 'సేవ్ అవుతోంది...',
      notesPlaceholder: 'ఐచ్ఛిక ఆర్డర్ కారణం లేదా గమనిక...',
      orderSaved: 'ఆర్డర్ SQLite లో సేవ్ చేయబడింది.',
      colOrderId: 'ఆర్డర్ ఐడీ',
      colType: 'రకం',
      colTotalValue: 'మొత్తం విలువ',
      emptyOrders: 'SQLite లో ఇన్వెస్టర్ ఆర్డర్లు సేవ్ చేయబడలేదు.',
      closed: 'మూసివేయబడింది',
    },
    news: {
      title: 'వార్తలు & NSE కార్పొరేట్ ఫైలింగ్స్',
      subtitle:
        'స్థానిక NSE PR121126 ఎక్స్ఛేంజ్ ఫైలింగ్స్ నుండి సేకరించిన కార్పొరేట్ ప్రకటనలు, బోర్డు సమావేశాలు మరియు కార్పొరేట్ చర్యలు',
      refreshBtn: 'ఫైలింగ్స్ రిఫ్రెష్ చేయండి',
      liveWireLabel: 'లైవ్ ఆర్థిక వార్తా ఫీడ్',
      connected: 'కనెక్ట్ అయింది',
      unavailableArchive: 'అందుబాటులో లేదు (ఎక్స్ఛేంజ్ ఫైలింగ్స్ ఆర్కైవ్)',
      sourcesLabel: 'మూల ఫైళ్ళు',
      allTab: 'అన్నీ',
      catAnnouncement: 'ప్రకటన',
      catBoardMeeting: 'బోర్డు సమావేశం',
      catCorporateAction: 'కార్పొరేట్ చర్య',
      searchPlaceholder: 'కంపెనీ లేదా ఫైలింగ్ వెతకండి...',
      articleNote: 'ఎక్స్ఛేంజ్ ప్రకటన శీర్షిక మాత్రమే అందుబాటులో ఉంది (పూర్తి కథనం ఫైల్‌లో లేదు)',
      originalTitleLabel: 'అసలు ఆంగ్ల శీర్షిక',
      translatedBadge: 'అనువదించబడింది',
      emptyNews: 'మీ శోధనకు సరిపోయే కార్పొరేట్ ఫైలింగ్స్ లేవు.',
      sourceLabel: 'మూలం',
    },
    profile: {
      title: 'ఇన్వెస్టర్ ఖాతా ప్రొఫైల్ & సలహాదారు కేంద్రం',
      subtitle: 'SQLite బేరర్ టోకెన్ ద్వారా ధృవీకరించబడిన సెషన్ (/api/auth/me)',
      signOutPortal: 'ఇన్వెస్టర్ పోర్టల్ నుండి సైన్ అవుట్',
      investorId: 'ఇన్వెస్టర్ యూజర్ ఐడీ',
      fullName: 'పూర్తి పేరు',
      emailAddress: 'ఇమెయిల్ చిరునామా',
      authorizedRole: 'అధికారిక పోర్టల్ పాత్ర',
      createdTimestamp: 'ఖాతా సృష్టించిన సమయం',
      sqliteActivity: 'SQLite ఖాతా కార్యకలాపాలు',
      watchlistStocks: 'వాచ్‌లిస్ట్ స్టాక్స్',
      holdingsTracked: 'ట్రాక్ చేసిన హోల్డింగ్స్',
      ordersLogged: 'నమోదైన ఇన్వెస్టర్ ఆర్డర్లు',
      totalInvested: 'మొత్తం పెట్టుబడి మూలధనం',
      languagePreference: 'ఇష్టమైన పోర్టల్ భాష',
      languageSavedNote: 'భాషా ప్రాధాన్యత మీ SQLite ప్రొఫైల్‌లో సేవ్ చేయబడి రిఫ్రెష్ తర్వాత కూడా ఉంటుంది.',
      brokerSectionTitle: 'కేటాయించిన బ్రోకర్ / క్వాంట్ సలహాదారు',
      brokerLinkedBadge: 'లింక్ చేయబడింది & సక్రియం',
      brokerUnlinkedBadge: 'లింక్ కాలేదు',
      brokerCodeLabel: 'బ్రోకర్ యూజర్ ఐడీ లేదా ఇమెయిల్',
      linkBrokerPlaceholder: 'ఉదా. BRK-QUANT-01',
      linkBrokerBtn: 'బ్రోకర్‌ను లింక్ చేయండి',
      brokerLinkedSuccess: 'బ్రోకర్ సలహాదారు మీ ఇన్వెస్టర్ ఖాతాకు లింక్ చేయబడ్డారు.',
      sectionAccount: 'ఖాతా & బ్రోకర్ లింక్',
      sectionRequests: 'నా అభ్యర్థనలు',
      sectionAdvice: 'అందిన నిపుణుల సలహా',
      sectionMessages: 'బ్రోకర్‌తో సందేశాలు',
    },
    advisory: {
      myRequestsTitle: 'నా సలహా అభ్యర్థనలు',
      myRequestsSubtitle: 'మీ బ్రోకర్‌కు పంపిన ప్రతి స్టాక్ ప్రశ్న మరియు పోర్ట్‌ఫోలియో సమీక్ష స్థితిని చూడండి',
      askNewQuestionTitle: 'కొత్త సలహా అభ్యర్థనను పంపండి',
      noRequests: 'మీరు ఇంకా ఏ బ్రోకర్ అభ్యర్థనను సమర్పించలేదు.',
      brokerResponsesLabel: 'బ్రోకర్ సమాధానం',
      expertAdviceTitle: 'మీ బ్రోకర్ నుండి నిపుణుల సలహా',
      expertAdviceSubtitle: 'మీ హోల్డింగ్స్, సాంకేతిక సూచికలు, ML సిగ్నల్స్ మరియు ATR/GARCH రిస్క్ ఆధారిత AI విశ్లేషణ',
      noAdvice: 'మీ ఖాతాకు ఇంకా ఎటువంటి నిపుణుల సలహా పంపబడలేదు.',
      markAsRead: 'చదివినట్లు గుర్తించండి',
      markedRead: 'చదివినది',
      recommendationLabel: 'చర్య సిఫార్సు',
      supportingIndicators: 'సహాయక సూచికలు & పోర్ట్‌ఫోలియో వివరాలు',
      riskLevelLabel: 'రిస్క్ స్థాయి',
      messagesTitle: 'మీ బ్రోకర్‌తో నేరుగా సందేశాలు',
      messagesSubtitle: 'మీ బ్రోకర్ / క్వాంట్ సలహాదారుతో శాశ్వత ద్వైపాక్షిక SQLite సంభాషణ',
      noMessages: 'ఇంకా సందేశాలు లేవు. క్రింద మీ బ్రోకర్‌కు సందేశం వ్రాయండి.',
      messagePlaceholder: 'మీ బ్రోకర్‌కు సందేశం వ్రాయండి...',
      sendMessageBtn: 'సందేశం పంపండి',
      linkBrokerFirst: 'సందేశాలు పంపడానికి ముందుగా ప్రొఫైల్‌లో బ్రోకర్ ఐడీ (ఉదా. BRK-QUANT-01) లింక్ చేయండి.',
      youLabel: 'మీరు',
      brokerLabel: 'బ్రోకర్',
    },
    statuses: {
      Pending: 'పెండింగ్‌లో ఉంది',
      'Under Review': 'సమీక్షలో ఉంది',
      Responded: 'సమాధానం అందింది',
      Closed: 'మూసివేయబడింది',
      Draft: 'డ్రాఫ్ట్',
      Sent: 'పంపబడింది',
      Read: 'చదివినది',
      EXECUTED: 'పూర్తయినది',
      PLANNED: 'ప్లాన్ చేయబడింది',
      CANCELLED: 'రద్దు చేయబడింది',
      Low: 'తక్కువ',
      Moderate: 'మధ్యస్థం',
      Elevated: 'ఎక్కువ',
      High: 'అధికం',
      BUY: 'కొనుగోలు (BUY)',
      SELL: 'అమ్మకం (SELL)',
      HOLD: 'హోల్డ్ (HOLD)',
    },
    chart: {
      priceVolume: 'ధర & వాల్యూమ్',
      rsiLabel: 'RSI (14)',
      macdLabel: 'MACD',
      signalLabel: 'సిగ్నల్',
      impactLabel: 'ఫీచర్ ప్రభావం',
      noOhlcv: 'ఈ ఎంపికకు OHLCV డేటా అందుబాటులో లేదు.',
      legendUp: 'బుల్లిష్ క్యాండిల్',
      legendDown: 'బేరిష్ క్యాండిల్',
    },
  },
};
