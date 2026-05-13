import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import ThemeToggle from "../components/ThemeToggle";
import { useAppContext } from "../hooks/useAppContext";
import RadialOrbitalTimeline from "../components/ui/radial-orbital-timeline";
import { CardStack } from "../components/ui/card-stack";
import { 
  Sparkles, 
  CheckCircle2, 
  History, 
  CreditCard, 
  ShieldCheck, 
  FileDown, 
  Zap,
  Calendar,
  Code
} from "lucide-react";

const XeroIcon = () => (
// ... (rest of the file until the features section)
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#059669"/>
    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">X</text>
  </svg>
);

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
  </svg>
);

// Scroll reveal hook
function useScrollReveal() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}

// Reusable wrapper component
const Reveal = ({ children, delay = 0, className = '' }) => {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default function Home() {
  const { error, clearError, isConnected, checkXeroSession } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [activeBucket, setActiveBucket] = useState(null);

  useEffect(() => {
    checkXeroSession();
    if (isConnected) navigate("/dashboard");
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [checkXeroSession, isConnected, navigate]);

  const handleConnect = () => {
    window.location.href = `/auth/login`;
  };

  const buckets = [
    { id: 'matched', label: 'Matched', count: 47, desc: 'Auto-approved with 99% confidence', bg: 'bg-app-surface', border: 'border-app-emerald/20', text: 'text-app-emerald', badge: 'bg-app-emerald/10 text-app-emerald' },
    { id: 'possible', label: 'Possible Matches', count: 12, desc: 'Review suggested pairings', bg: 'bg-app-surface', border: 'border-amber-500/20', text: 'text-amber-500', badge: 'bg-amber-500/10 text-amber-500' },
    { id: 'unmatched-bank', label: 'Unmatched (Bank)', count: 5, desc: 'Missing from Xero?', bg: 'bg-app-surface', border: 'border-blue-500/20', text: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-500' },
    { id: 'unmatched-xero', label: 'Unmatched (Xero)', count: 3, desc: 'Missing from bank?', bg: 'bg-app-surface', border: 'border-purple-500/20', text: 'text-purple-500', badge: 'bg-purple-500/10 text-purple-500' },
  ];

  const orbitalFeatures = [
    {
      id: 1,
      title: 'Smart Matching',
      date: 'Core AI',
      content: 'Fuzzy logic pairs transactions even with slight description mismatches, learning from your manual approvals over time.',
      category: 'AI',
      icon: Sparkles,
      relatedIds: [2, 3],
      status: 'completed',
      energy: 100,
    },
    {
      id: 2,
      title: 'Bulk Actions',
      date: 'Efficiency',
      content: 'Approve up to 50 matches with a single click. Our high-confidence engine ensures accuracy while saving you hours.',
      category: 'Workflow',
      icon: CheckCircle2,
      relatedIds: [1, 6],
      status: 'completed',
      energy: 95,
    },
    {
      id: 3,
      title: 'Audit Trail',
      date: 'Compliance',
      content: 'Every decision is logged with timestamps and metadata. Your accountant will have a full history of every reconciliation.',
      category: 'Trust',
      icon: History,
      relatedIds: [1, 5],
      status: 'completed',
      energy: 88,
    },
    {
      id: 4,
      title: 'Multi-Bank Support',
      date: 'Universal',
      content: 'Works with any bank CSV export. We automatically clean and normalize data from thousands of financial institutions.',
      category: 'Data',
      icon: CreditCard,
      relatedIds: [2, 6],
      status: 'completed',
      energy: 92,
    },
    {
      id: 5,
      title: 'Secure by Design',
      date: 'Security',
      content: 'OAuth 2.0 secure connection to Xero. We never store your credentials. SOC 2 compliant data handling.',
      category: 'Security',
      icon: ShieldCheck,
      relatedIds: [3, 4],
      status: 'completed',
      energy: 100,
    },
    {
      id: 6,
      title: 'Export Reports',
      date: 'Reporting',
      content: 'Generate PDF or Excel reconciliation summaries for your records. Perfect for month-end closing and tax preparation.',
      category: 'Output',
      icon: FileDown,
      relatedIds: [2, 4],
      status: 'completed',
      energy: 85,
    },
  ];

  const steps = [
    { icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>, title: 'Connect', desc: 'One-click secure connection to your Xero organization.' },
    { icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>, title: 'Upload', desc: 'Drop your bank statement. We handle CSV, OFX, and QIF.' },
    { icon: <Sparkles className="w-8 h-8" />, title: 'Match', desc: 'Our engine auto-matches 85%+ of transactions in seconds.' },
    { icon: <CheckCircle2 className="w-8 h-8" />, title: 'Review', desc: 'Approve matches in four clean buckets. Download your report. Done.' },
  ];

  const testimonialItems = [
    {
      id: 1,
      title: "Sarah K.",
      description: "What used to take me a full Friday afternoon now takes 20 minutes. I actually reconciled during my coffee break.",
      tag: "Freelance Designer",
    },
    {
      id: 2,
      title: "James T.",
      description: "We cut our bookkeeper's reconciliation time by 80%. The ROI was obvious in week one. Scarily accurate matching.",
      tag: "E-commerce Owner",
    },
    {
      id: 3,
      title: "Priya M.",
      description: "The 'Possible Matches' bucket is genius. It catches the edge cases without making me hunt for them.",
      tag: "Virtual Bookkeeper",
    },
    {
      id: 4,
      title: "Mark R.",
      description: "Seamless Xero integration. The audit trail is a lifesaver for our tax filings and compliance audits.",
      tag: "SaaS Founder",
    },
    {
      id: 5,
      title: "Elena G.",
      description: "Best reconciliation tool I've used. Simple, fast, and secure. It just works exactly as promised.",
      tag: "Agency Director",
    },
  ];

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans transition-colors duration-300">
      {error && <ErrorAlert message={error} onClose={clearError} />}

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-app-bg/90 backdrop-blur-md border-b border-app-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-serif font-bold text-2xl text-app-text tracking-tight">BankSync</div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-app-text-muted uppercase tracking-widest">
            <a href="#how-it-works" className="hover:text-app-text transition">How It Works</a>
            <a href="#features" className="hover:text-app-text transition">Features</a>
            <a href="#pricing" className="hover:text-app-text transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={handleConnect} className="bg-app-emerald text-white px-6 py-2 rounded-full text-sm font-bold hover:opacity-90 transition shadow-lg shadow-app-emerald/20">
              Connect to Xero
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-app-bg transition-colors duration-500">
        <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q 25 0, 50 50 T 100 50' stroke='%2310B981' fill='none' stroke-width='0.5'/%3E%3Cpath d='M50 0 Q 100 25, 50 50 T 50 100' stroke='%2310B981' fill='none' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="font-serif font-extrabold text-5xl lg:text-7xl text-app-text leading-[1.1] mb-6">
              Reconcile in<br />Minutes, <span className="text-app-emerald">Not Hours</span>
            </h1>
            <p className="text-lg text-app-text-secondary max-w-[560px] mb-8 leading-relaxed font-medium">
              AI-powered matching connects your bank statements to Xero invoices automatically. No more spreadsheet hell.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleConnect} className="bg-app-emerald text-white px-8 py-4 rounded-full font-semibold hover:opacity-90 shadow-lg shadow-app-emerald/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
                Start Free Trial
              </button>
              <button onClick={() => setShowVideo(true)} className="flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-app-border font-bold text-app-text hover:bg-app-muted transition-all">
                <PlayIcon /> See How It Works
              </button>
            </div>
            <div className="mt-12 flex items-center gap-6">
              <span className="text-sm text-app-text-secondary font-bold uppercase tracking-widest">Trusted by 2,000+ businesses</span>
              <div className="flex text-amber-400 text-sm">★★★★★</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-4">
              {buckets.map((b) => (
                <div key={b.id} onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)} className={`${b.bg} ${b.border} border-2 rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all duration-200 ${activeBucket === b.id ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${b.badge} mb-3`}>{b.label}</span>
                  <div className={`text-3xl font-bold ${b.text}`}>{b.count}</div>
                  <p className="text-xs text-app-text-muted mt-1 font-medium">{b.desc}</p>
                  {activeBucket === b.id && (
                    <div className="mt-3 pt-3 border-t border-app-border text-xs space-y-1">
                      <div className="flex justify-between text-app-text"><span>INV-001</span><span className="font-bold">$250.00</span></div>
                      <div className="flex justify-between text-app-text"><span>INV-002</span><span className="font-bold">$180.50</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-app-text-muted mt-4 italic font-medium">This is what clarity looks like.</p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <Reveal>
        <section className="py-24 bg-app-surface">
          <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 relative overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-red-100">
                    <p className="text-sm text-red-600 font-mono">#REF! Error in cell D42</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-yellow-100">
                    <p className="text-sm text-yellow-700">⏳ Matching transaction...</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 opacity-60">
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="font-serif font-bold text-4xl text-app-text mb-6">You didn't start a business to do this.</h2>
              <p className="text-lg text-app-text-secondary leading-relaxed mb-8 font-medium">
                Every month, hours disappear into manually matching transactions. One typo. One missed invoice. One reconciliation error. And your books are off.
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[{ val: '6.5', unit: 'hrs', label: 'average monthly reconciliation time' }, { val: '34%', unit: '', label: 'of SMBs have reconciliation errors quarterly' }, { val: '£2,400', unit: '', label: 'average cost of bookkeeping corrections/year' }].map((s, i) => (
                  <div key={i} className="bg-app-surface rounded-xl p-5 text-center border border-app-border shadow-sm">
                    <div className="text-3xl font-black text-app-text">{s.val}<span className="text-lg text-app-text-muted">{s.unit}</span></div>
                    <p className="text-[10px] text-app-text-muted mt-1 uppercase font-bold tracking-widest leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How It Works */}
      <Reveal>
        <section id="how-it-works" className="py-24 bg-app-surface">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-center mb-16 text-app-text tracking-tight">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {steps.map((s, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="text-center group">
                    <div className="w-16 h-16 mx-auto mb-4 bg-app-emerald/10 rounded-full flex items-center justify-center text-app-emerald group-hover:scale-110 transition-transform duration-300">
                      {s.icon}
                    </div>
                    <div className="text-xs text-app-emerald font-bold mb-1 uppercase tracking-widest">Step {i + 1}</div>
                    <h3 className="font-bold text-xl mb-2 text-app-text">{s.title}</h3>
                    <p className="text-sm text-app-text-muted font-medium">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Features */}
      <Reveal>
        <section id="features" className="py-24 bg-app-surface text-app-text">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="font-serif font-bold text-4xl mb-4 text-app-text">Everything you need</h2>
            <p className="text-app-text-muted max-w-2xl mx-auto mb-16 font-medium">Explore the core engines powering your financial automation through our interactive orbital system.</p>
            
            <div className="relative">
              <RadialOrbitalTimeline timelineData={orbitalFeatures} />
            </div>
          </div>
        </section>
      </Reveal>

      {/* Testimonials */}
      <Reveal>
        <section className="py-24 bg-app-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="font-serif font-bold text-4xl text-app-text mb-4">Loved by business owners</h2>
              <p className="text-app-text-muted max-w-2xl mx-auto font-medium">See how thousands of founders and finance teams are reclaiming their Fridays.</p>
            </div>
            
            <div className="max-w-xl mx-auto">
              <CardStack
                items={testimonialItems}
                autoAdvance
                intervalMs={3500}
                cardWidth={400}
                cardHeight={320}
                depthPx={80}
              />
            </div>
          </div>
        </section>
      </Reveal>

      {/* Pricing */}
      <Reveal>
        <section id="pricing" className="py-24 bg-app-bg transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-center mb-4 text-app-text">Simple, transparent pricing</h2>
            <p className="text-center text-app-text-muted mb-16 font-medium">14-day free trial. No credit card required. Cancel anytime.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto items-stretch">
              {[
                { name: 'Starter', price: '19', features: ['500 transactions/mo', '2 bank accounts', 'Email support', 'Basic reports'] },
                { name: 'Professional', price: '49', popular: true, features: ['2,000 transactions/mo', '10 bank accounts', 'Priority support', 'Advanced matching', 'Export to PDF'] },
                { name: 'Business', price: '99', features: ['Unlimited transactions', 'Unlimited accounts', 'Dedicated support', 'API access', 'Custom reports'] },
              ].map((p, i) => (
                <Reveal key={i} delay={i * 100} className="h-full">
                  <div className={`h-full bg-app-bg rounded-xl p-8 border-2 ${p.popular ? 'border-app-emerald shadow-xl scale-105 z-10' : 'border-app-border'} relative flex flex-col`}>
                { p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-app-emerald text-white text-xs font-black px-4 py-1 rounded-full tracking-widest shadow-lg shadow-app-emerald/30">MOST POPULAR</div>}
                    <h3 className="font-black text-2xl mb-2 text-app-text">{p.name}</h3>
                    <div className="mb-6"><span className="text-4xl font-black text-app-text">${p.price}</span><span className="text-app-text-muted font-bold">/mo</span></div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {p.features.map((f, j) => <li key={j} className="flex items-center gap-2 text-sm text-app-text font-medium"><CheckCircle2 className="w-4 h-4 text-app-emerald" /> {f}</li>)}
                    </ul>
                    <button onClick={handleConnect} className={`w-full py-4 rounded-full font-black transition-all ${p.popular ? 'bg-app-emerald text-white hover:opacity-90 shadow-lg shadow-app-emerald/20' : 'border-2 border-app-text hover:bg-app-text hover:text-app-bg'}`}>
                      Start Free Trial
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Final CTA */}
      <Reveal>
        <section className="py-32 bg-app-emerald relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)' }} />
          <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-white mb-4">Stop reconciling. Start running your business.</h2>
            <p className="text-emerald-100 mb-8">Join 2,000+ businesses who've reclaimed their Fridays.</p>
            <button onClick={handleConnect} className="bg-app-surface text-app-emerald px-10 py-4 rounded-full font-semibold shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2">
              <XeroIcon /> Connect to Xero
            </button>
            <p className="text-emerald-200 text-sm mt-4">Free 14-day trial • No credit card • Setup in 2 minutes</p>
            <p className="text-emerald-300 text-sm mt-2 underline cursor-pointer">Questions? Chat with our team</p>
          </div>
        </section>
      </Reveal>

      {/* Footer */}
      <footer className="bg-[#0F172A] py-16 text-white/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {['Product', 'Resources', 'Company', 'Legal'].map((col) => (
              <div key={col}>
                <h4 className="text-white font-semibold mb-4">{col}</h4>
                <ul className="space-y-2 text-sm">
                  {[1,2,3].map((i) => <li key={i} className="hover:text-white cursor-pointer">Link {i}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">© 2026 BankSync. All rights reserved.</p>
            <p className="text-xs">Built with ☕ and frustration with spreadsheets</p>
          </div>
        </div>
      </footer>

      {/* Video Lightbox */}
      {showVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setShowVideo(false)}>
          <div className="bg-white rounded-2xl p-4 max-w-3xl w-full aspect-video flex items-center justify-center">
            <p className="text-gray-500">60-second demo video would play here</p>
          </div>
        </div>
      )}
    </div>
  );
}
