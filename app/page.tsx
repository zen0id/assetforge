'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Command,
  Copy,
  Eye,
  FileCode,
  History,
  Keyboard,
  Palette,
  Play,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';

type Tab = 'svg' | 'json' | 'css';

type HistoryItem = {
  id: number;
  tab: Tab;
  title: string;
  input: string;
  output: string;
  createdAt: string;
};

const DEFAULT_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
</svg>`;

const DEFAULT_JSON = `{
  "user": "Developer",
  "status": "active",
  "metrics": {
    "score": 98.4,
    "verified": true
  },
  "roles": ["builder", "engineer"]
}`;

const STORAGE_KEY = 'assetforge-workbench-v2';

const tabMeta: Record<Tab, { label: string; icon: React.ReactNode; accent: string }> = {
  svg: { label: 'SVG → JSX', icon: <Code2 size={15} />, accent: 'indigo' },
  json: { label: 'JSON → TypeScript', icon: <FileCode size={15} />, accent: 'emerald' },
  css: { label: 'Glass Engine', icon: <Palette size={15} />, accent: 'purple' },
};

function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function escapeTypeName(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, '_');
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned || 'Root';
}

function propertyName(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function jsonToTypescript(value: unknown, name = 'RootObject', depth = 0): string {
  const indent = '  '.repeat(depth);

  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return 'unknown[]';

    const itemTypes = [...new Set(value.map((item) => jsonToTypescript(item, `${name}Item`, depth)))];
    return itemTypes.length === 1 ? `${itemTypes[0]}[]` : `(${itemTypes.join(' | ')})[]`;
  }

  if (typeof value !== 'object') return typeof value;

  const entries = Object.entries(value as Record<string, unknown>);
  const childInterfaces: string[] = [];
  const lines = [`export interface ${escapeTypeName(name)} {`];

  for (const [key, child] of entries) {
    const childName = `${escapeTypeName(key)}${depth === 0 ? '' : 'Value'}`;
    let type: string;

    if (child && typeof child === 'object' && !Array.isArray(child)) {
      type = childName;
      childInterfaces.push(jsonToTypescript(child, childName, depth + 1));
    } else if (Array.isArray(child) && child[0] && typeof child[0] === 'object') {
      type = `${childName}Item[]`;
      childInterfaces.push(jsonToTypescript(child[0], `${childName}Item`, depth + 1));
    } else {
      type = jsonToTypescript(child, childName, depth + 1);
    }

    lines.push(`${indent}  ${propertyName(key)}: ${type};`);
  }

  lines.push(`${indent}}`);
  return [...childInterfaces.reverse(), lines.join('\n')].join('\n\n');
}

function convertSvgToJsx(input: string) {
  if (!input.trim()) return '';

  let clean = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\sclass=/g, ' className=')
    .replace(/\sfor=/g, ' htmlFor=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/fill-opacity=/g, 'fillOpacity=')
    .replace(/stroke-opacity=/g, 'strokeOpacity=')
    .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
    .replace(/stroke-dasharray=/g, 'strokeDasharray=')
    .replace(/stroke-dashoffset=/g, 'strokeDashoffset=')
    .replace(/(\w+):(\w+)/g, '$1$2');

  clean = clean.replace(
    /<svg\b([^>]*)>/i,
    (_match, attrs) => `<svg {...props}${attrs ? ` ${attrs.trim()}` : ''}>`
  );

  return `import React from 'react';

export const CustomIcon = (
  props: React.SVGProps<SVGSVGElement>
) => (
  ${clean}
);`;
}

function sanitizeSvg(svg: string) {
  // Preview only: remove executable/scriptable SVG constructs.
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, '');
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('svg');
  const [svgInput, setSvgInput] = useState(DEFAULT_SVG);
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [blur, setBlur] = useState(16);
  const [opacity, setOpacity] = useState(0.18);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');

  const jsxOutput = useMemo(() => convertSvgToJsx(svgInput), [svgInput]);

  const { tsOutput, jsonValid } = useMemo(() => {
    if (!jsonInput.trim()) return { tsOutput: '', jsonValid: true };
    try {
      return {
        tsOutput: jsonToTypescript(JSON.parse(jsonInput)),
        jsonValid: true,
      };
    } catch {
      return {
        tsOutput: '// SyntaxError: Invalid JSON structure.',
        jsonValid: false,
      };
    }
  }, [jsonInput]);

  const cssOutput = useMemo(
    () =>
      `.glass {
  background: rgba(255, 255, 255, ${opacity});
  backdrop-filter: blur(${blur}px);
  -webkit-backdrop-filter: blur(${blur}px);
  border: 1px solid rgba(255, 255, 255, 0.20);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}`,
    [blur, opacity]
  );

  const currentOutput =
    activeTab === 'svg' ? jsxOutput : activeTab === 'json' ? tsOutput : cssOutput;

  const currentInput =
    activeTab === 'svg' ? svgInput : activeTab === 'json' ? jsonInput : cssOutput;

  useEffect(() => {
    try {
      setHistory(readHistory());
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
  }, [history]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setShowHistory(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const saveSnapshot = () => {
    const item: HistoryItem = {
      id: Date.now(),
      tab: activeTab,
      title: tabMeta[activeTab].label,
      input: currentInput,
      output: currentOutput,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory((items) => [item, ...items].slice(0, 20));
  };

  const restoreSnapshot = (item: HistoryItem) => {
    setActiveTab(item.tab);
    if (item.tab === 'svg') setSvgInput(item.input);
    if (item.tab === 'json') setJsonInput(item.input);
    setShowHistory(false);
  };

  const clearCurrent = () => {
    if (activeTab === 'svg') setSvgInput('');
    if (activeTab === 'json') setJsonInput('');
  };

  const loadSample = () => {
    if (activeTab === 'svg') setSvgInput(DEFAULT_SVG);
    if (activeTab === 'json') setJsonInput(DEFAULT_JSON);
    if (activeTab === 'css') {
      setBlur(16);
      setOpacity(0.18);
    }
  };

  const commands = [
    ['SVG → JSX', () => setActiveTab('svg')],
    ['JSON → TypeScript', () => setActiveTab('json')],
    ['Glass Engine', () => setActiveTab('css')],
    ['Load sample', loadSample],
    ['Save snapshot', saveSnapshot],
    ['Open history', () => setShowHistory(true)],
  ].filter(([label]) => String(label).toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-slate-200 selection:bg-indigo-500/30">
      {/* Legacy terminal atmosphere */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,.18),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(168,85,247,.10),transparent_32%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_50%,transparent_50%)] bg-[length:100%_4px] opacity-30" />

      <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.28em] text-indigo-300/70">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 shadow-[0_0_12px_currentColor]" />
              AssetForge // Legacy Workbench
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Developer Utility Engine
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Deterministic converters, visual inspection and design-system utilities in one persistent workspace.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-400 transition hover:border-indigo-400/30 hover:text-white sm:flex"
            >
              <Command size={12} /> COMMAND
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[9px]">⌘K</kbd>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-400 transition hover:border-indigo-400/30 hover:text-white"
            >
              <History size={12} /> HISTORY
            </button>
          </div>
        </header>

        {/* Main shell */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Status rail */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3 py-2">
            <div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-400/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Engine online
              </span>
              <span className="hidden sm:inline">Build 2.4.7</span>
              <span className="hidden md:inline">Local state: persistent</span>
            </div>
            <span className="font-mono text-[9px] text-slate-600">
              {currentOutput.length.toLocaleString()} chars
            </span>
          </div>

          {/* Tabs */}
          <nav className="flex overflow-x-auto border-b border-white/10 bg-black/20">
            {(Object.keys(tabMeta) as Tab[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`group relative flex min-w-max items-center gap-2 px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider transition sm:px-5 ${
                    active
                      ? 'bg-white/[0.045] text-white'
                      : 'text-slate-500 hover:bg-white/[0.025] hover:text-slate-300'
                  }`}
                >
                  {tabMeta[tab].icon}
                  {tabMeta[tab].label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-px bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,.8)]" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 sm:p-5">
            {/* SVG */}
            {activeTab === 'svg' && (
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <EditorPanel
                  label="Raw SVG Source"
                  status={svgInput.trim() ? 'PARSED' : 'EMPTY'}
                  statusGood={Boolean(svgInput.trim())}
                  value={svgInput}
                  onChange={setSvgInput}
                  placeholder="Paste raw SVG code here..."
                  onSample={loadSample}
                  onClear={clearCurrent}
                />
                <OutputPanel
                  label="React JSX Component"
                  value={jsxOutput}
                  accent="indigo"
                  onCopy={() => copyToClipboard(jsxOutput)}
                  onSave={saveSnapshot}
                  onDownload={() => downloadText('CustomIcon.tsx', jsxOutput)}
                >
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3">
                    <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-slate-600">
                      <Eye size={12} /> Live render
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-slate-950 text-indigo-300">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgInput) }} />
                    </div>
                  </div>
                </OutputPanel>
              </div>
            )}

            {/* JSON */}
            {activeTab === 'json' && (
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <EditorPanel
                  label="Input JSON Object"
                  status={jsonValid ? 'VALID JSON' : 'SYNTAX ERROR'}
                  statusGood={jsonValid}
                  value={jsonInput}
                  onChange={setJsonInput}
                  placeholder="Paste a JSON object..."
                  onSample={loadSample}
                  onClear={clearCurrent}
                />
                <OutputPanel
                  label="Generated TypeScript"
                  value={tsOutput}
                  accent="emerald"
                  onCopy={() => copyToClipboard(tsOutput)}
                  onSave={saveSnapshot}
                  onDownload={() => downloadText('types.ts', tsOutput)}
                />
              </div>
            )}

            {/* CSS */}
            {activeTab === 'css' && (
              <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                  <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    <Zap size={13} className="text-purple-400" /> Precision controls
                  </div>

                  <RangeControl label="Backdrop Blur" value={blur} min={0} max={40} suffix="px" onChange={setBlur} />
                  <RangeControl
                    label="Alpha Opacity"
                    value={opacity}
                    min={0.05}
                    max={0.8}
                    step={0.01}
                    suffix="%"
                    display={Math.round(opacity * 100)}
                    onChange={setOpacity}
                  />

                  <button
                    onClick={loadSample}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <RotateCcw size={11} /> Reset engine
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,.24),transparent_45%),#090b12] p-8">
                    <div
                      className="absolute h-44 w-44 rounded-full bg-purple-500/20 blur-3xl"
                      style={{ transform: `translateX(${blur - 20}px)` }}
                    />
                    <div
                      style={{
                        backdropFilter: `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        backgroundColor: `rgba(255,255,255,${opacity})`,
                      }}
                      className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 p-6 text-center shadow-2xl"
                    >
                      <div className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white">
                        AssetForge Glass
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-white/50">
                        Real-time material preview
                      </div>
                    </div>
                  </div>

                  <OutputPanel
                    label="Generated CSS"
                    value={cssOutput}
                    accent="purple"
                    onCopy={() => copyToClipboard(cssOutput)}
                    onSave={saveSnapshot}
                    onDownload={() => downloadText('glass.css', cssOutput)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer diagnostics */}
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[9px] uppercase tracking-wider text-slate-700">
          <span className="flex items-center gap-2">
            <Terminal size={11} /> No server required · browser-native processing
          </span>
          <span>{history.length}/20 snapshots retained</span>
        </footer>
      </section>

      {copied && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-400/20 bg-[#0b1511]/95 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 shadow-2xl backdrop-blur-xl">
          <Check size={13} /> Copied to clipboard
        </div>
      )}

      {/* Command palette */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setCommandOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14] shadow-2xl shadow-black" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Search size={15} className="text-slate-600" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search commands..." className="h-12 flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-slate-700" />
              <button onClick={() => setCommandOpen(false)}><X size={14} className="text-slate-600 hover:text-white" /></button>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {commands.map(([label, action]) => (
                <button
                  key={String(label)}
                  onClick={() => { (action as () => void)(); setCommandOpen(false); setQuery(''); }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="flex items-center gap-3"><ChevronRight size={12} /> {String(label)}</span>
                  <span className="text-slate-700">ENTER</span>
                </button>
              ))}
              {!commands.length && <div className="p-5 text-center font-mono text-[10px] text-slate-700">NO COMMANDS FOUND</div>}
            </div>
          </div>
        </div>
      )}

      {/* History drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onMouseDown={() => setShowHistory(false)}>
          <aside className="ml-auto h-full w-full max-w-md border-l border-white/10 bg-[#090c11] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-white">Workspace history</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-600">Local snapshots · max 20</div>
              </div>
              <button onClick={() => setShowHistory(false)}><X size={16} className="text-slate-500 hover:text-white" /></button>
            </div>

            <div className="space-y-2 overflow-auto">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => restoreSnapshot(item)}
                  className="group w-full rounded-lg border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-indigo-400/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase text-slate-300">{item.title}</span>
                    <span className="font-mono text-[9px] text-slate-700">{item.createdAt}</span>
                  </div>
                  <div className="mt-2 truncate font-mono text-[9px] text-slate-600">{item.input.replace(/\s+/g, ' ').slice(0, 100)}</div>
                </button>
              ))}
              {!history.length && <div className="rounded-lg border border-dashed border-white/10 p-8 text-center font-mono text-[10px] uppercase text-slate-700">No snapshots yet</div>}
            </div>

            {!!history.length && (
              <button
                onClick={() => setHistory([])}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-rose-400/10 bg-rose-500/[0.03] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-rose-400/70 hover:text-rose-300"
              >
                <Trash2 size={11} /> Clear history
              </button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function EditorPanel({
  label,
  status,
  statusGood,
  value,
  onChange,
  placeholder,
  onSample,
  onClear,
}: {
  label: string;
  status: string;
  statusGood: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSample: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${statusGood ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {label}
        </label>
        <div className="flex gap-3 font-mono text-[9px] uppercase">
          <button onClick={onSample} className="flex items-center gap-1 text-slate-600 hover:text-slate-300"><Sparkles size={10} /> Sample</button>
          <button onClick={onClear} className="flex items-center gap-1 text-slate-600 hover:text-rose-400"><RotateCcw size={10} /> Clear</button>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder={placeholder}
          className="h-96 w-full resize-none rounded-lg border border-white/10 bg-[#06080c] p-4 font-mono text-[11px] leading-6 text-slate-300 outline-none transition placeholder:text-slate-800 focus:border-indigo-400/30 focus:ring-1 focus:ring-indigo-400/10"
        />
        <div className="absolute bottom-3 right-3 rounded border border-white/5 bg-black/60 px-2 py-1 font-mono text-[8px] text-slate-700">
          {value.length.toLocaleString()} CHARS · {status}
        </div>
      </div>
    </div>
  );
}

function OutputPanel({
  label,
  value,
  accent,
  onCopy,
  onSave,
  onDownload,
  children,
}: {
  label: string;
  value: string;
  accent: 'indigo' | 'emerald' | 'purple';
  onCopy: () => void;
  onSave: () => void;
  onDownload?: () => void;
  children?: React.ReactNode;
}) {
  const text = accent === 'emerald' ? 'text-emerald-300' : accent === 'purple' ? 'text-purple-300' : 'text-indigo-300';
  const border = accent === 'emerald' ? 'border-emerald-400/10' : accent === 'purple' ? 'border-purple-400/10' : 'border-indigo-400/10';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>
        <div className="flex items-center gap-1">
          {onDownload && (
            <button onClick={onDownload} title="Download" className="rounded border border-white/5 p-1.5 text-slate-600 hover:text-white"><Save size={12} /></button>
          )}
          <button onClick={onSave} title="Save snapshot" className="rounded border border-white/5 p-1.5 text-slate-600 hover:text-white"><History size={12} /></button>
          <button onClick={onCopy} title="Copy" className={`flex items-center gap-1.5 rounded border ${border} bg-white/[0.025] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider ${text} hover:bg-white/[0.05]`}>
            <Copy size={11} /> Copy
          </button>
        </div>
      </div>

      <textarea
        readOnly
        value={value}
        spellCheck={false}
        className={`h-96 w-full resize-none rounded-lg border border-white/10 bg-[#06080c] p-4 font-mono text-[11px] leading-6 outline-none ${text}`}
      />

      {children}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  display?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        <span className="text-purple-300">{display ?? value}{suffix === '%' ? '%' : suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-purple-400"
      />
    </div>
  );
}
