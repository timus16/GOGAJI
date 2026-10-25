"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/shared/Button";
import Image from "next/image";

interface GeneratorPreviewProps {
  imageUrl: string;
  prompt: string;
  report?: any;
  reading?: any;
  provider?: string;
}

export function GeneratorPreview({ imageUrl, prompt, report, reading, provider }: GeneratorPreviewProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReading, setShowReading] = useState(false);

  const downloadImage = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nakshatra-canvas-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100">Your Wallpaper</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? "Hide" : "Show"} Prompt
          </Button>
          {report && (
            <Button variant="ghost" size="sm" onClick={() => setShowReport(!showReport)}>
              {showReport ? "Hide" : "Show"} Report
            </Button>
          )}
          {reading && (
            <Button variant="ghost" size="sm" onClick={() => setShowReading(!showReading)}>
              {showReading ? "Hide" : "Show"} Reading
            </Button>
          )}
          <Button onClick={downloadImage} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
            Download
          </Button>
        </div>
      </div>

      <div className="aspect-[9/16] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
        <img
          src={imageUrl}
          alt="Generated Vedic Wallpaper"
          className="w-full h-full object-cover"
        />
      </div>

      {showPrompt && (
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg max-h-64 overflow-auto">
          <h4 className="font-medium mb-2">AI Prompt</h4>
          <p className="text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{prompt}</p>
        </div>
      )}

      {showReport && report && (
        <InternalReport report={report} />
      )}

      {showReading && reading && (
        <AiReadingDisplay reading={reading} provider={provider} />
      )}
    </div>
  );
}

function InternalReport({ report }: { report: any }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (key: string) => setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const isExpanded = (key: string) => expanded.includes(key);

  return (
    <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
      <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100">Vedic Analysis Report</h3>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" open>
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Birth Chart Summary</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ReportItem label="Lagna" value={report.lagna} />
          <ReportItem label="Moon" value={report.moon} />
          <ReportItem label="Sun" value={report.sun} />
          <ReportItem label="Nakshatra" value={`${report.nakshatra} Pada ${report.pada}`} />
        </div>
      </details>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Planetary Positions</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left pb-2 text-slate-500">Planet</th>
                <th className="text-left pb-2 text-slate-500">Sign</th>
                <th className="text-left pb-2 text-slate-500">House</th>
                <th className="text-left pb-2 text-slate-500">Nakshatra</th>
                <th className="text-left pb-2 text-slate-500">Dignity</th>
                <th className="text-left pb-2 text-slate-500">Retrograde</th>
              </tr>
            </thead>
            <tbody>
              {report.planets?.map((p: any) => (
                <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2">{p.sign} {(p.degree || 0).toFixed(2)}°</td>
                  <td className="py-2">H{p.house}</td>
                  <td className="py-2">{p.nakshatra} P{p.pada}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.dignity === "exalted" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                      p.dignity === "debilitated" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                      p.dignity === "own_sign" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {p.dignity}
                    </span>
                  </td>
                  <td className="py-2">{p.retrograde ? "↺" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Current Vimśottarī Daśā</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {report.dasha?.map((d: any) => {
            const isCurrent = new Date(d.startDate) <= new Date() && new Date(d.endDate) >= new Date();
            return (
              <div key={d.planet} className={`flex items-center justify-between p-3 rounded ${isCurrent ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                <div>
                  <span className="font-medium">{d.planet} Mahadasha</span>
                  <span className="ml-2 text-sm text-slate-500">{new Date(d.startDate).toLocaleDateString()} – {new Date(d.endDate).toLocaleDateString()}</span>
                </div>
                {isCurrent && <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded">Current</span>}
              </div>
            );
          })}
        </div>
      </details>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Astrological Conditions & Remedies</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-4">
          {report.problems?.map((p: any) => (
            <div key={p.id} className={`p-4 rounded-lg border-l-4 ${p.severity === "high" ? "bg-red-50 dark:bg-red-900/20 border-red-500" : p.severity === "medium" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-500" : "bg-green-50 dark:bg-green-900/20 border-green-500"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h5 className="font-medium text-slate-900 dark:text-slate-100">{p.title}</h5>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{p.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Basis: {p.astrologicalBasis}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${p.severity === "high" ? "bg-red-100 text-red-800" : p.severity === "medium" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                  {p.severity}
                </span>
              </div>
              {p.remedies && p.remedies.length > 0 && (
                <div className="mt-3 space-y-1">
                  {p.remedies.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-medium">{r.type}</span>
                      <span className="font-medium">{r.title}</span>
                      <span className="text-slate-600 dark:text-slate-400">– {r.instructions}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Regional Context</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-2 text-sm">
          <div><span className="font-medium">Calendar:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.calendarType}</span></div>
          <div><span className="font-medium">New Year:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.newYear}</span></div>
          <div><span className="font-medium">Key Festivals:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.festivals?.map((f: any) => f.name).join(", ")}</span></div>
        </div>
      </details>

      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Panchang (Five Limbs)</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ReportItem label="Tithi" value={report.panchang?.tithi} />
          <ReportItem label="Nakshatra" value={report.panchang?.nakshatra} />
          <ReportItem label="Yoga" value={report.panchang?.yoga} />
          <ReportItem label="Karana" value={report.panchang?.karana} />
          <ReportItem label="Vara" value={report.panchang?.vara} />
          <ReportItem label="Masa" value={`${report.panchang?.masa} (${report.panchang?.paksha} paksha)`} />
        </div>
      </details>
    </div>
  );
}

function ReportItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function AiReadingDisplay({ reading, provider }: { reading: any; provider?: string }) {
  return (
    <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100">AI Vedic Reading</h3>
        {provider && (
          <span className="rounded-full border border-amber-500/25 bg-black/40 px-2 py-0.5 text-xs text-amber-200">
            Read by {provider}
          </span>
        )}
      </div>

      {reading.condition && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="font-medium text-slate-900 dark:text-slate-100">{reading.condition}</p>
        </div>
      )}

      {reading.reading && (
        <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
          <p>{reading.reading}</p>
        </div>
      )}

      {reading.remedies && reading.remedies.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Remedies</h4>
          {reading.remedies.map((r: any, i: number) => (
            <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium">{r.type}</span>
              <span className="ml-2 font-medium">{r.title}</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{r.detail}</p>
              <p className="text-xs text-slate-500">Mantra: {r.mantraRoman} ({r.mantraDevanagari})</p>
              <p className="text-xs text-slate-500">Deity: {r.deity} • Day: {r.day}</p>
            </div>
          ))}
        </div>
      )}

      {reading.affirmation && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-center italic text-slate-900 dark:text-slate-100">"{reading.affirmation}"</p>
        </div>
      )}

      {reading.wallpaperBrief && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
          <p className="font-medium mb-1">Art Direction:</p>
          <p className="text-slate-600 dark:text-slate-400">Mood: {reading.wallpaperBrief.mood}</p>
          <p className="text-slate-600 dark:text-slate-400">Palette: {reading.wallpaperBrief.palette}</p>
          <p className="text-slate-600 dark:text-slate-400">Motifs: {reading.wallpaperBrief.motifs}</p>
          <p className="text-slate-600 dark:text-slate-400">Inscription: {reading.wallpaperBrief.inscription}</p>
        </div>
      )}
    </div>
  );
}