import type { LanguageCode } from '../types/index.ts';

export interface TranslationBundle {
  brandTagline: string;
  navHome: string;
  navInvestor: string;
  navBroker: string;
  navPractice: string;
  signIn: string;
  signOut: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaInvestor: string;
  heroCtaBroker: string;
  heroCtaPractice: string;
  historicalNotice: string;
  investorHeading: string;
  investorSubheading: string;
  brokerHeading: string;
  brokerSubheading: string;
  practiceHeading: string;
  practiceSubheading: string;
  stockExplorer: string;
  detailedAnalysis: string;
  aiPredictionPanel: string;
  explainableAi: string;
  riskAnalysis: string;
  fundamentalsNews: string;
  askBullseyeAi: string;
  explainThis: string;
  trainModelBtn: string;
  runBacktestBtn: string;
  executePipelineBtn: string;
  placeOrderBtn: string;
  resetPortfolioBtn: string;
  virtualWallet: string;
  availableBalance: string;
  portfolioValue: string;
  realizedPnl: string;
  unrealizedPnl: string;
  simulatedBanner: string;
  modelNotTrainedMsg: string;
  stopLossDisclaimer: string;
  aiTitle: string;
  aiPlaceholder: string;
  suggestedQuestionsTitle: string;
  suggestedQuestions: string[];
}

export const TRANSLATIONS: Record<LanguageCode, TranslationBundle> = {
  en: {
    brandTagline: 'Invest Smarter. Understand Deeper.',
    navHome: 'Overview',
    navInvestor: 'Investor Portal',
    navBroker: 'Broker / Quant',
    navPractice: 'Practice Trading',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    heroTitle: 'Algorithmic Market Intelligence Built for Indian Equities',
    heroSubtitle:
      'Analyze 5 years of verified NIFTY 50 historical data, train leak-free machine learning models, inspect SHAP & technical feature attributions, forecast GARCH(1,1) volatility, and practice trading with ₹10,00,000 virtual capital.',
    heroCtaInvestor: 'Explore Investor Portal',
    heroCtaBroker: 'Explore Broker Portal',
    heroCtaPractice: 'Enter Practice Trading',
    historicalNotice:
      'Historical NSE NIFTY 50 Dataset (Oct 2020 – 30 Sep 2025). Prices shown reflect the latest available dataset close, not live 2026 market quotes.',
    investorHeading: 'Investor Intelligence Portal',
    investorSubheading:
      'Beginner-friendly technical clarity, explainable ML signals, and disciplined ATR position sizing.',
    brokerHeading: 'Broker & Quantitative Research Terminal',
    brokerSubheading:
      'Inspect the 9-stage data pipeline, mathematical feature formulas, chronological ML training, GARCH(1,1) volatility, and historical backtesting.',
    practiceHeading: 'Practice Trading Simulator',
    practiceSubheading:
      'Execute simulated NSE orders against verified historical closing prices with ₹10,00,000 virtual capital.',
    stockExplorer: 'NIFTY 50 Stock Explorer',
    detailedAnalysis: 'Detailed Technical & Indicator Analysis',
    aiPredictionPanel: 'AI Signal & Probability Output',
    explainableAi: 'Explainable AI & Technical Drivers',
    riskAnalysis: 'ATR Risk & Position Sizing Calculator',
    fundamentalsNews: 'Fundamentals & Market News',
    askBullseyeAi: 'Ask BULLSEYE AI',
    explainThis: 'Explain this',
    trainModelBtn: 'Train Model',
    runBacktestBtn: 'Run Backtest',
    executePipelineBtn: 'Refresh & Verify Pipeline',
    placeOrderBtn: 'Place Simulated Order',
    resetPortfolioBtn: 'Reset ₹10L Wallet',
    virtualWallet: 'Virtual Wallet',
    availableBalance: 'Available Cash',
    portfolioValue: 'Total Portfolio Value',
    realizedPnl: 'Realized P&L',
    unrealizedPnl: 'Unrealized P&L',
    simulatedBanner:
      'Simulated paper trading environment — no real money is used and no live exchange orders are placed.',
    modelNotTrainedMsg: 'Model not trained yet — prediction unavailable.',
    stopLossDisclaimer:
      'Note: ATR stop-loss levels are risk-management references and do not guarantee maximum loss due to overnight price gaps and slippage.',
    aiTitle: 'BULLSEYE AI Copilot',
    aiPlaceholder: 'Ask about indicators, ML signals, risk sizing, or backtests...',
    suggestedQuestionsTitle: 'Suggested Questions',
    suggestedQuestions: [
      "Explain today's stock movement.",
      'Why is this stock showing a BUY or HOLD signal?',
      'Explain RSI in simple words.',
      'What does MACD indicate?',
      'How is the stop-loss calculated?',
      'Compare RELIANCE and TCS.',
      "Explain the model's prediction.",
      'What does the backtest result mean?',
    ],
  },
  hi: {
    brandTagline: 'Invest Smarter. Understand Deeper.',
    navHome: 'अवलोकन',
    navInvestor: 'निवेशक पोर्टल',
    navBroker: 'ब्रोकर / क्वांट',
    navPractice: 'प्रैक्टिस ट्रेडिंग',
    signIn: 'साइन इन',
    signOut: 'लॉग आउट',
    heroTitle: 'भारतीय शेयर बाजार के लिए AI-आधारित एल्गोरिदमिक विश्लेषण',
    heroSubtitle:
      'NIFTY 50 के 5 वर्षों के ऐतिहासिक डेटा का विश्लेषण करें, बिना डेटा-लीकेज के मशीन लर्निंग मॉडल ट्रेन करें, SHAP और तकनीकी संकेत समझें, GARCH(1,1) वोलैटिलिटी देखें और ₹10,00,000 वर्चुअल पूंजी के साथ ट्रेडिंग का अभ्यास करें।',
    heroCtaInvestor: 'निवेशक पोर्टल खोलें',
    heroCtaBroker: 'ब्रोकर / क्वांट पोर्टल',
    heroCtaPractice: 'प्रैक्टिस ट्रेडिंग शुरू करें',
    historicalNotice:
      'ऐतिहासिक NSE NIFTY 50 डेटासेट (अक्टूबर 2020 – 30 सितंबर 2025)। दिखाई गई कीमतें नवीनतम उपलब्ध डेटासेट क्लोज़ हैं, लाइव बाज़ार भाव नहीं।',
    investorHeading: 'निवेशक विश्लेषण पोर्टल',
    investorSubheading:
      'आसान तकनीकी विश्लेषण, व्याख्यात्मक AI सिग्नल और ATR जोखिम प्रबंधन।',
    brokerHeading: 'ब्रोकर एवं क्वांटिटेटिव रिसर्च टर्मिनल',
    brokerSubheading:
      'डेटा पाइपलाइन, गणितीय फ़ॉर्मूले, क्रोनोलॉजिकल ML ट्रेनिंग, GARCH(1,1) वोलैटिलिटी और बैकटेस्टिंग देखें।',
    practiceHeading: 'प्रैक्टिस ट्रेडिंग सिम्युलेटर',
    practiceSubheading:
      '₹10,00,000 वर्चुअल पूंजी के साथ बिना वास्तविक जोखिम के ट्रेडिंग का अभ्यास करें।',
    stockExplorer: 'NIFTY 50 स्टॉक एक्सप्लोरर',
    detailedAnalysis: 'विस्तृत तकनीकी चार्ट एवं इंडिकेटर विश्लेषण',
    aiPredictionPanel: 'AI सिग्नल और संभाव्यता',
    explainableAi: 'व्याख्यात्मक AI और तकनीकी कारण',
    riskAnalysis: 'ATR जोखिम और पोजीशन साइज़ कैलकुलेटर',
    fundamentalsNews: 'फंडामेंटल्स और बाज़ार समाचार',
    askBullseyeAi: 'BULLSEYE AI से पूछें',
    explainThis: 'इसे समझाएं',
    trainModelBtn: 'मॉडल ट्रेन करें',
    runBacktestBtn: 'बैकटेस्ट चलाएं',
    executePipelineBtn: 'पाइपलाइन सत्यापित करें',
    placeOrderBtn: 'सिम्युलेटेड ऑर्डर दें',
    resetPortfolioBtn: '₹10L वॉलेट रीसेट करें',
    virtualWallet: 'वर्चुअल वॉलेट',
    availableBalance: 'उपलब्ध नकद',
    portfolioValue: 'कुल पोर्टफोलियो मूल्य',
    realizedPnl: 'रियलाइज़्ड P&L',
    unrealizedPnl: 'अनरियलाइज़्ड P&L',
    simulatedBanner:
      'यह एक सिम्युलेटेड पेपर ट्रेडिंग वातावरण है — कोई वास्तविक पैसा या लाइव एक्सचेंज ऑर्डर शामिल नहीं है।',
    modelNotTrainedMsg: 'मॉडल अभी ट्रेन नहीं हुआ है — पूर्वानुमान अनुपलब्ध।',
    stopLossDisclaimer:
      'नोट: ATR स्टॉप-लॉस केवल संदर्भ स्तर हैं और प्राइस गैप या स्लिपेज के कारण अधिकतम नुकसान की गारंटी नहीं देते।',
    aiTitle: 'BULLSEYE AI सहायक',
    aiPlaceholder: 'इंडिकेटर, ML सिग्नल, स्टॉप-लॉस या बैकटेस्ट के बारे में पूछें...',
    suggestedQuestionsTitle: 'सुझाए गए प्रश्न',
    suggestedQuestions: [
      'आज के स्टॉक मूवमेंट को समझाएं।',
      'यह स्टॉक BUY या HOLD सिग्नल क्यों दिखा रहा है?',
      'RSI को सरल शब्दों में समझाएं।',
      'MACD क्या दर्शाता है?',
      'स्टॉप-लॉस की गणना कैसे की जाती है?',
      'RELIANCE और TCS की तुलना करें।',
      'मॉडल के पूर्वानुमान को समझाएं।',
      'बैकटेस्ट परिणाम का क्या अर्थ है?',
    ],
  },
  te: {
    brandTagline: 'Invest Smarter. Understand Deeper.',
    navHome: 'అవలోకనం',
    navInvestor: 'ఇన్వెస్టర్ పోర్టల్',
    navBroker: 'బ్రోకర్ / క్వాంట్',
    navPractice: 'ప్రాక్టీస్ ట్రేడింగ్',
    signIn: 'సైన్ ఇన్',
    signOut: 'సైన్ అవుట్',
    heroTitle: 'భారతీయ స్టాక్ మార్కెట్ కోసం AI అల్గారిథమిక్ విశ్లేషణ',
    heroSubtitle:
      '5 సంవత్సరాల NIFTY 50 చారిత్రక డేటాను విశ్లేషించండి, మెషిన్ లెర్నింగ్ మోడల్స్ ట్రైన్ చేయండి, SHAP మరియు సాంకేతిక సూచికలను అర్థం చేసుకోండి, GARCH(1,1) అస్థిరతను అంచనా వేయండి మరియు ₹10,00,000 వర్చువల్ క్యాపిటల్‌తో ట్రేడింగ్ ప్రాక్టీస్ చేయండి.',
    heroCtaInvestor: 'ఇన్వెస్టర్ పోర్టల్ చూడండి',
    heroCtaBroker: 'బ్రోకర్ / క్వాంట్ పోర్టల్',
    heroCtaPractice: 'ప్రాక్టీస్ ట్రేడింగ్ ప్రారంభించండి',
    historicalNotice:
      'చారిత్రక NSE NIFTY 50 డేటాసెట్ (అక్టోబర్ 2020 – 30 సెప్టెంబర్ 2025). చూపబడిన ధరలు తాజా డేటాసెట్ ముగింపు ధరలు మాత్రమే, లైవ్ 2026 మార్కెట్ ధరలు కావు.',
    investorHeading: 'ఇన్వెస్టర్ ఇంటెలిజెన్స్ పోర్టల్',
    investorSubheading:
      'సులభమైన సాంకేతిక విశ్లేషణ, వివరణాత్మక AI సిగ్నల్స్ మరియు ATR రిస్క్ మేనేజ్‌మెంట్.',
    brokerHeading: 'బ్రోకర్ & క్వాంటిటేటివ్ రీసెర్చ్ టెర్మినల్',
    brokerSubheading:
      'డేటా పైప్‌లైన్, గణిత సూత్రాలు, క్రోనోలాజికల్ ML ట్రైనింగ్, GARCH(1,1) మరియు బ్యాక్‌టెస్టింగ్.',
    practiceHeading: 'ప్రాక్టీస్ ట్రేడింగ్ సిమ్యులేటర్',
    practiceSubheading:
      '₹10,00,000 వర్చువల్ క్యాపిటల్‌తో నిజమైన డబ్బు ప్రమాదం లేకుండా ట్రేడింగ్ సాధన చేయండి.',
    stockExplorer: 'NIFTY 50 స్టాక్ ఎక్స్‌ప్లోరర్',
    detailedAnalysis: 'వివరమైన చార్ట్ & ఇండికేటర్ విశ్లేషణ',
    aiPredictionPanel: 'AI సిగ్నల్ & సంభావ్యత',
    explainableAi: 'వివరణాత్మక AI & సాంకేతిక కారణాలు',
    riskAnalysis: 'ATR రిస్క్ & పొజిషన్ సైజ్ కాలిక్యులేటర్',
    fundamentalsNews: 'ఫండమెంటల్స్ & మార్కెట్ వార్తలు',
    askBullseyeAi: 'BULLSEYE AI ని అడగండి',
    explainThis: 'దీన్ని వివరించండి',
    trainModelBtn: 'మోడల్ ట్రైన్ చేయండి',
    runBacktestBtn: 'బ్యాక్‌టెస్ట్ నడపండి',
    executePipelineBtn: 'పైప్‌లైన్ రిఫ్రెష్ చేయండి',
    placeOrderBtn: 'సిమ్యులేటెడ్ ఆర్డర్ వేయండి',
    resetPortfolioBtn: '₹10L వాలెట్ రీసెట్',
    virtualWallet: 'వర్చువల్ వాలెట్',
    availableBalance: 'అందుబాటులో ఉన్న నగదు',
    portfolioValue: 'మొత్తం పోర్ట్‌ఫోలియో విలువ',
    realizedPnl: 'రియలైజ్డ్ P&L',
    unrealizedPnl: 'అన్‌రియలైజ్డ్ P&L',
    simulatedBanner:
      'ఇది సిమ్యులేటెడ్ పేపర్ ట్రేడింగ్ వాతావరణం — నిజమైన డబ్బు లేదా లైవ్ ఎక్స్ఛేంజ్ ఆర్డర్లు ఉపయోగించబడవు.',
    modelNotTrainedMsg: 'మోడల్ ఇంకా ట్రైన్ కాలేదు — అంచనా అందుబాటులో లేదు.',
    stopLossDisclaimer:
      'గమనిక: ATR స్టాప్-లాస్ ధరలు రిస్క్ మార్గదర్శకాలు మాత్రమే; ధర గ్యాప్‌లు మరియు స్లిప్పేజ్ వల్ల గరిష్ట నష్టానికి హామీ ఇవ్వవు.',
    aiTitle: 'BULLSEYE AI సహాయకుడు',
    aiPlaceholder: 'ఇండికేటర్లు, ML సిగ్నల్స్, స్టాప్-లాస్ లేదా బ్యాక్‌టెస్ట్ గురించి అడగండి...',
    suggestedQuestionsTitle: 'సూచించిన ప్రశ్నలు',
    suggestedQuestions: [
      'ఈ రోజు స్టాక్ కదలికను వివరించండి.',
      'ఈ స్టాక్ BUY లేదా HOLD సిగ్నల్ ఎందుకు చూపిస్తోంది?',
      'RSI ని సాధారణ పదాలలో వివరించండి.',
      'MACD ఏమి సూచిస్తుంది?',
      'స్టాప్-లాస్ ఎలా లెక్కిస్తారు?',
      'RELIANCE మరియు TCS ని పోల్చండి.',
      'మోడల్ అంచనాను వివరించండి.',
      'బ్యాక్‌టెస్ట్ ఫలితం అర్థం ఏమిటి?',
    ],
  },
};
