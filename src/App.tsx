import React, { useState, useEffect, useRef } from "react";
import type { ExploitDB } from "./data";
import { BentoGrid, BentoGridItem } from "./components/ui/bento-grid";
import { Spotlight } from "./components/ui/spotlight";
import { ExpandableCard } from "./components/ui/expandable-card";
import { ThreatBubbleChart } from "./components/ui/threat-bubble-chart";
import { Search, Filter, ChevronDown, Flame } from "lucide-react";
import { generateThumbnail } from "./lib/utils";

function formatNarrative(text: string) {
  // Split on numbered steps like (1), (2), etc.
  const stepRegex = /\((\d+)\)\s*/g;
  const parts: { type: "intro" | "step" | "outro"; num?: number; text: string }[] = [];
  
  const matches = [...text.matchAll(stepRegex)];
  
  if (matches.length === 0) {
    return <p className="text-sm leading-relaxed text-neutral-400">{text}</p>;
  }

  // Intro: everything before (1)
  const intro = text.slice(0, matches[0].index).trim();
  if (intro) parts.push({ type: "intro", text: intro });

  // Each step
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : undefined;
    let stepText = text.slice(start, end).trim();
    // If the outro is attached to the last step, split on the last sentence that doesn't feel like a step
    parts.push({ type: "step", num: parseInt(matches[i][1]), text: stepText });
  }

  // Check if the last step's text has trailing sentences after a period that seem like an outro
  const lastStep = parts[parts.length - 1];
  if (lastStep.type === "step") {
    // Look for sentences after the step action that are attributions/conclusions
    const sentences = lastStep.text.split(/(?<=\.)\s+/);
    if (sentences.length > 2) {
      // Heuristic: if a sentence doesn't start with a verb/action word, it might be outro
      const actionStarters = /^(The |Attacker|Using|Funds|Approved|Transferred|Executed|Minted|Called|Placed|Used|Drained|Gained|On |Over |April|March|No |A |Team )/i;
      let splitIdx = -1;
      for (let j = sentences.length - 1; j >= 1; j--) {
        if (!actionStarters.test(sentences[j])) continue;
        // Keep checking — we want the last chunk that feels like summary
      }
      // Simpler: don't split, keep as is
    }
  }

  // Highlight 0x addresses
  const highlightText = (str: string) => {
    const addrRegex = /(0x[a-fA-F0-9]{8,})/g;
    const segments = str.split(addrRegex);
    return segments.map((seg, i) =>
      addrRegex.test(seg) ? (
        <code key={i} className="text-xs bg-neutral-800 text-amber-400/80 px-1 py-0.5 rounded font-mono break-all">{seg}</code>
      ) : (
        <span key={i}>{seg}</span>
      )
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, i) => {
        if (part.type === "intro") {
          return (
            <p key={i} className="text-sm leading-relaxed text-neutral-300">
              {highlightText(part.text)}
            </p>
          );
        }
        if (part.type === "step") {
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-700/80 text-neutral-300 text-xs font-bold flex items-center justify-center mt-0.5">
                {part.num}
              </div>
              <p className="text-sm leading-relaxed text-neutral-400 flex-1">
                {highlightText(part.text)}
              </p>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-neutral-500 italic border-t border-neutral-700/50 pt-3 mt-1">
            {highlightText(part.text)}
          </p>
        );
      })}
    </div>
  );
}
import { motion } from "framer-motion";

function useCountUp(end: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { value, ref };
}

export default function App() {
  const [data, setData] = useState<ExploitDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChain, setSelectedChain] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");

  useEffect(() => {
    fetch("/db.json")
      .then(res => res.json())
      .then((db: ExploitDB) => { setData(db); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Disable browser scroll restoration and force top on first paint AND after data loads
  // (the page is much taller after data renders, which is when the browser tries to "restore").
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!loading) {
      // Strip any hash the browser may have used to jump to an anchor.
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo(0, 0);
    }
  }, [loading]);

  const totalLossM = data ? data.exploits.reduce((acc, curr) => {
    if (!curr.loss_amount) return acc;
    const amount = parseFloat(curr.loss_amount.replace(/[^0-9.]/g, ""));
    const multiplier = curr.loss_amount.includes("B") ? 1000 : curr.loss_amount.includes("K") ? 0.001 : 1;
    return acc + amount * multiplier;
  }, 0) : 0;
  const totalLossB = Math.round(totalLossM / 100) / 10;

  const criticalExploits = data ? data.exploits.filter(e => e.severity === "Critical").length : 0;

  const totalLossCounter = useCountUp(Math.round(totalLossB * 10));
  const criticalCounter = useCountUp(criticalExploits);
  const vectorsCounter = useCountUp(data ? data.attack_types.length : 0);
  const categoriesCount = data ? Object.keys(data.attack_types.reduce((acc, curr) => {
    acc[curr.category] = true;
    return acc;
  }, {} as Record<string, boolean>)).length : 0;
  const categoriesCounter = useCountUp(categoriesCount);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-black/[0.96] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Loading exploit database…</div>
      </div>
    );
  }

  const uniqueChains = ["All", ...Array.from(new Set(data.exploits.map(e => e.chain)))];
  const uniqueSeverities = ["All", ...Array.from(new Set(data.exploits.map(e => e.severity)))];

  const filteredExploits = data.exploits.filter(exploit => {
    const matchesSearch = exploit.affected_protocol.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exploit.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChain = selectedChain === "All" || exploit.chain === selectedChain;
    const matchesSeverity = selectedSeverity === "All" || exploit.severity === selectedSeverity;
    
    return matchesSearch && matchesChain && matchesSeverity;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expandCardsData = filteredExploits.map(exploit => {
    const attackType = data.attack_types.find(t => t.id === exploit.attack_type);
    const category = attackType?.category || "Unknown";
    const thumbnail = exploit.thumbnail
      || generateThumbnail(exploit.affected_protocol.name, category);
    return {
      id: exploit.id,
      title: exploit.affected_protocol.name,
      description: exploit.description,
      tag: exploit.severity,
      date: exploit.date,
      src: thumbnail,
      attackVector: attackType?.name || exploit.attack_type,
      loss: exploit.loss_amount,
      ctaText: "View Post-Mortem",
      ctaLink: typeof exploit.links === 'string' ? exploit.links : (exploit.links && exploit.links[0] ? exploit.links[0] : "#"),
      content: () => (
        <div className="flex flex-col gap-6 text-neutral-300 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-800/60 rounded-xl p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Date</span>
              <span className="text-sm font-medium text-neutral-200">{new Date(exploit.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
            </div>
            <div className="bg-neutral-800/60 rounded-xl p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Severity</span>
              <span className={`text-sm font-semibold ${exploit.severity === "Critical" ? "text-red-400" : exploit.severity === "High" ? "text-orange-400" : exploit.severity === "Medium" ? "text-yellow-400" : exploit.severity === "Low" ? "text-green-400" : "text-neutral-300"}`}>{exploit.severity}</span>
            </div>
            <div className="bg-neutral-800/60 rounded-xl p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Chain</span>
              <span className="text-sm font-medium text-neutral-200">{exploit.chain}</span>
            </div>
            <div className="bg-neutral-800/60 rounded-xl p-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Losses</span>
              <span className="text-sm font-semibold text-neutral-200">{exploit.loss_amount || "Unknown"}</span>
            </div>
          </div>
          <div className="bg-neutral-800/60 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0">Attack Vector</span>
            <span className="text-sm font-medium text-neutral-200">{data.attack_types.find(t => t.id === exploit.attack_type)?.name || exploit.attack_type}</span>
          </div>
          <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-700/50">
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Detailed Attack Narrative</h4>
            {exploit.detailed_narrative
              ? formatNarrative(exploit.detailed_narrative)
              : <p className="text-sm text-neutral-500 italic">No detailed narrative available yet.</p>
            }
          </div>
          {Array.isArray(exploit.links) && exploit.links.length > 1 && (
            <div className="bg-neutral-800/50 p-5 rounded-xl border border-neutral-700/50">
              <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wide">References</h4>
              <ol className="list-decimal list-inside flex flex-col gap-1.5">
                {exploit.links.slice(1).map((link: string, i: number) => (
                  <li key={i} className="text-sm text-neutral-400">
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all">
                      {link.replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/')}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )
    };
  });

  return (
    <div className="min-h-screen bg-black/[0.96] antialiased bg-grid-white/[0.02] text-white">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <main className="w-full px-6 md:px-12 lg:px-16 pt-6 pb-16">
        {/* Header */}
        <div className="relative z-10 w-full pb-12">
          <h1 className="text-2xl md:text-3xl font-bold font-saira tracking-tight">
            <span className="text-red-500">web3</span>
            <span className="text-neutral-400">threat</span>
            <span className="text-neutral-600">.actor</span>
          </h1>
        </div>

        {/* Threat Landscape Overview */}
        <div className="mb-32 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 px-4 gap-2">
            <div>
              <h2 className="text-2xl font-bold text-white font-saira">Threat Landscape</h2>
              <p className="text-sm text-neutral-500 mt-1">Each bubble is an attack vector — sized by total losses, colored by category.</p>
            </div>
          </div>

          {/* KPI ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 px-4">
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total value lost</div>
              <div className="mt-1 text-2xl font-bold font-geom text-red-400">
                <span ref={totalLossCounter.ref}>${(totalLossCounter.value / 10).toFixed(1)}B+</span>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">Critical incidents</div>
              <div className="mt-1 text-2xl font-bold font-geom text-purple-400">
                <span ref={criticalCounter.ref}>{criticalCounter.value}</span>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">Attack vectors</div>
              <div className="mt-1 text-2xl font-bold font-geom text-blue-400">
                <span ref={vectorsCounter.ref}>{vectorsCounter.value}</span>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">Categories</div>
              <div className="mt-1 text-2xl font-bold font-geom text-emerald-400">
                <span ref={categoriesCounter.ref}>{categoriesCounter.value}</span>
              </div>
            </div>
          </div>

          <div className="px-4">
            <ThreatBubbleChart
              attackTypes={data.attack_types}
              exploits={data.exploits}
            />
          </div>
        </div>

        {/* Exploits - Bento Grid */}
        <div className="relative z-10">
          <div className="mb-8 px-4 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white font-saira">Historical Exploits</h2>
          </div>
          <div className="max-w-7xl mx-auto mb-8 px-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-neutral-500" />
              </div>
              <input 
                type="text" 
                placeholder="Search exploits, protocols, tx..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black/50 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 w-full text-white focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 font-google-sans text-sm transition-all shadow-input"
              />
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-auto min-w-[140px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3.5 w-3.5 text-neutral-500" />
                </div>
                <select 
                  value={selectedChain} 
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="appearance-none bg-black/50 border border-neutral-800 rounded-xl pl-9 pr-10 py-2.5 w-full text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 cursor-pointer font-google-sans text-sm transition-all shadow-sm"
                >
                  {uniqueChains.map(chain => <option key={chain} value={chain} className="bg-neutral-900">{chain === "All" ? "All Chains" : chain}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                </div>
              </div>
              
              <div className="relative w-full md:w-auto min-w-[140px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Flame className="h-3.5 w-3.5 text-neutral-500" />
                </div>
                <select 
                  value={selectedSeverity} 
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="appearance-none bg-black/50 border border-neutral-800 rounded-xl pl-9 pr-10 py-2.5 w-full text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-700 focus:border-neutral-700 cursor-pointer font-google-sans text-sm transition-all shadow-sm"
                >
                  {uniqueSeverities.map(severity => <option key={severity} value={severity} className="bg-neutral-900">{severity === "All" ? "All Severities" : severity}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto py-0">
             <ExpandableCard cards={expandCardsData} />
          </div>
        </div>
      </main>
    </div>
  );
}
