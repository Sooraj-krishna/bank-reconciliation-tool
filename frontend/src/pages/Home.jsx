import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../hooks/useAppContext";

const XeroIcon = () => (
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

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
    { id: 'matched', label: 'Matched', count: 47, desc: 'Auto-approved with 99% confidence', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
    { id: 'possible', label: 'Possible Matches', count: 12, desc: 'Review suggested pairings', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    { id: 'unmatched-bank', label: 'Unmatched (Bank)', count: 5, desc: 'Missing from Xero?', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    { id: 'unmatched-xero', label: 'Unmatched (Xero)', count: 3, desc: 'Missing from bank?', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  ];

  const features = [
    { icon: <SparkleIcon />, title: 'Smart Matching', desc: 'Fuzzy logic pairs transactions even with slight description mismatches.' },
    { icon: <CheckIcon />, title: 'Bulk Actions', desc: 'Approve 50 matches with one click.' },
    { icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, title: 'Audit Trail', desc: 'Every decision logged. Your accountant will thank you.' },
    { icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>, title: 'Multi-Bank Support', desc: 'Works with any bank CSV export.' },
    { icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>, title: 'Secure by Design', desc: 'OAuth 2.0. No credentials stored. SOC 2 compliant.' },
    { icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, title: 'Export Reports', desc: 'PDF reconciliation summaries for your records.' },
  ];

  const steps = [
    { icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>, title: 'Connect', desc: 'One-click secure connection to your Xero organization.' },
    { icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>, title: 'Upload', desc: 'Drop your bank statement. We handle CSV, OFX, and QIF.' },
    { icon: <SparkleIcon />, title: 'Match', desc: 'Our engine auto-matches 85%+ of transactions in seconds.' },
    { icon: <CheckIcon />, title: 'Review', desc: 'Approve matches in four clean buckets. Download your report. Done.' },
  ];

  const testimonials = [
    { quote: "What used to take me a full Friday afternoon now takes 20 minutes. I actually reconciled during my coffee break.", name: "Sarah K.", role: "Freelance Designer", initial: "S" },
    { quote: "We cut our bookkeeper's reconciliation time by 80%. The ROI was obvious in week one.", name: "James T.", role: "E-commerce Owner", initial: "J" },
    { quote: "The 'Possible Matches' bucket is genius. It catches the edge cases without making me hunt for them.", name: "Priya M.", role: "Virtual Bookkeeper", initial: "P" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#1A1A1A]">
      {error && <ErrorAlert message={error} onClose={clearError} />}

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-serif font-bold text-xl text-[#1A1A1A]">BankSync</div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#64748B]">
            <a href="#how-it-works" className="hover:text-[#1A1A1A] transition">How It Works</a>
            <a href="#features" className="hover:text-[#1A1A1A] transition">Features</a>
            <a href="#pricing" className="hover:text-[#1A1A1A] transition">Pricing</a>
          </nav>
          <button onClick={handleConnect} className="bg-[#059669] text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-emerald-700 transition shadow-sm">
            Connect to Xero
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-[#FDFBF7] to-[#F0F4F1]">
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q 25 0, 50 50 T 100 50' stroke='%23059669' fill='none' stroke-width='0.5'/%3E%3Cpath d='M50 0 Q 100 25, 50 50 T 50 100' stroke='%23059669' fill='none' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="font-serif font-extrabold text-5xl lg:text-6xl text-[#1A1A1A] leading-tight mb-6">
              Reconcile in<br />Minutes, <span className="text-[#059669]">Not Hours</span>
            </h1>
            <p className="text-lg text-[#64748B] max-w-[560px] mb-8 leading-relaxed">
              AI-powered matching connects your bank statements to Xero invoices automatically. No more spreadsheet hell.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleConnect} className="bg-[#059669] text-white px-8 py-4 rounded-full font-semibold hover:bg-emerald-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
                Start Free Trial
              </button>
              <button onClick={() => setShowVideo(true)} className="flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-[#1A1A1A]/20 font-medium hover:border-[#1A1A1A]/40 transition">
                <PlayIcon /> See How It Works
              </button>
            </div>
            <div className="mt-12 flex items-center gap-6">
              <span className="text-sm text-[#64748B]">Trusted by 2,000+ small businesses</span>
              <div className="flex text-amber-400 text-sm">★★★★★</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-4">
              {buckets.map((b) => (
                <div key={b.id} onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)} className={`${b.bg} ${b.border} border-2 rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all duration-200 ${activeBucket === b.id ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${b.badge} mb-3`}>{b.label}</span>
                  <div className={`text-3xl font-bold ${b.text}`}>{b.count}</div>
                  <p className="text-xs text-[#64748B] mt-1">{b.desc}</p>
                  {activeBucket === b.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-1">
                      <div className="flex justify-between"><span>INV-001</span><span>$250.00</span></div>
                      <div className="flex justify-between"><span>INV-002</span><span>$180.50</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#64748B] mt-4 italic">This is what clarity looks like.</p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <Reveal>
        <section className="py-24 bg-white">
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
              <h2 className="font-serif font-bold text-4xl text-[#1A1A1A] mb-6">You didn't start a business to do this.</h2>
              <p className="text-lg text-[#64748B] leading-relaxed mb-8">
                Every month, hours disappear into manually matching transactions. One typo. One missed invoice. One reconciliation error. And your books are off.
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[{ val: '6.5', unit: 'hrs', label: 'average monthly reconciliation time' }, { val: '34%', unit: '', label: 'of SMBs have reconciliation errors quarterly' }, { val: '£2,400', unit: '', label: 'average cost of bookkeeping corrections/year' }].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-5 text-center border border-gray-100">
                    <div className="text-3xl font-bold text-[#1A1A1A]">{s.val}<span className="text-lg text-[#64748B]">{s.unit}</span></div>
                    <p className="text-xs text-[#64748B] mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How It Works */}
      <Reveal>
        <section id="how-it-works" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-center mb-16 text-[#1A1A1A]">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {steps.map((s, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="text-center group">
                    <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center text-[#059669] group-hover:bg-emerald-100 transition">
                      {s.icon}
                    </div>
                    <div className="text-sm text-[#059669] font-semibold mb-1">Step {i + 1}</div>
                    <h3 className="font-bold text-lg mb-2 text-[#1A1A1A]">{s.title}</h3>
                    <p className="text-sm text-[#64748B]">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Features */}
      <Reveal>
        <section id="features" className="py-24 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-center mb-16 text-[#1A1A1A]">Everything you need</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#059669] hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                    <div className="text-[#059669] mb-4">{f.icon}</div>
                    <h3 className="font-bold text-lg mb-2 text-[#1A1A1A]">{f.title}</h3>
                    <p className="text-sm text-[#64748B]">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Testimonials */}
      <Reveal>
        <section className="py-24 bg-[#1A1A1A]">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-white text-center mb-16">Loved by business owners</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((t, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="bg-white/5 rounded-xl p-8 border border-white/10">
                    <p className="text-white/90 italic mb-6 leading-relaxed">"{t.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#059669] flex items-center justify-center text-white font-bold">
                        {t.initial}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{t.name}</p>
                        <p className="text-white/60 text-xs">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Pricing */}
      <Reveal>
        <section id="pricing" className="py-24 bg-gradient-to-b from-[#F0F4F1] to-[#FDFBF7]">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-center mb-4 text-[#1A1A1A]">Simple, transparent pricing</h2>
            <p className="text-center text-[#64748B] mb-16">14-day free trial. No credit card required. Cancel anytime.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { name: 'Starter', price: '19', features: ['500 transactions/mo', '2 bank accounts', 'Email support', 'Basic reports'] },
                { name: 'Professional', price: '49', popular: true, features: ['2,000 transactions/mo', '10 bank accounts', 'Priority support', 'Advanced matching', 'Export to PDF'] },
                { name: 'Business', price: '99', features: ['Unlimited transactions', 'Unlimited accounts', 'Dedicated support', 'API access', 'Custom reports'] },
              ].map((p, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className={`bg-white rounded-xl p-8 border-2 ${p.popular ? 'border-[#059669] shadow-xl scale-105' : 'border-gray-200'} relative`}>
                    {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>}
                    <h3 className="font-bold text-xl mb-2 text-[#1A1A1A]">{p.name}</h3>
                    <div className="mb-6"><span className="text-4xl font-bold text-[#1A1A1A]">${p.price}</span><span className="text-[#64748B]">/mo</span></div>
                    <ul className="space-y-3 mb-8">
                      {p.features.map((f, j) => <li key={j} className="flex items-center gap-2 text-sm text-[#1A1A1A]"><CheckIcon /> {f}</li>)}
                    </ul>
                    <button onClick={handleConnect} className={`w-full py-3 rounded-full font-medium transition ${p.popular ? 'bg-[#059669] text-white hover:bg-emerald-700' : 'border-2 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'}`}>
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
        <section className="py-32 bg-[#059669] relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)' }} />
          <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
            <h2 className="font-serif font-bold text-4xl text-white mb-4">Stop reconciling. Start running your business.</h2>
            <p className="text-emerald-100 mb-8">Join 2,000+ businesses who've reclaimed their Fridays.</p>
            <button onClick={handleConnect} className="bg-white text-[#059669] px-10 py-4 rounded-full font-semibold shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2">
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
