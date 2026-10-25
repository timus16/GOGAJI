"use client";

import { useState } from "react";
import { Button } from "@/components/shared/Button";

interface InternalReportProps {
  report: any;
}

export function InternalReport({ report }: InternalReportProps) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const isExpanded = (key: string) => expanded.includes(key);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100">Your Vedic Analysis Report</h3>

      {/* Core Chart */}
      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Birth Chart Summary</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ReportItem label="Ascendant" value={report.chart?.ascendantSign || "—"} />
          <ReportItem label="Moon" value={`${report.chart?.planets?.find((p: any) => p.planet === "Moon")?.sign || "—"}`} />
          <ReportItem label="Sun" value={`${report.chart?.planets?.find((p: any) => p.planet === "Sun")?.sign || "—"}`} />
          <ReportItem label="Nakshatra" value={`${report.chart?.ascendantNakshatra || "—"} Pada ${report.chart?.ascendantPada || "—"}`} />
        </div>
      </details>

      {/* Planetary Positions */}
      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" open>
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
              {report.chart?.planets?.map((p: any) => (
                <tr key={p.planet} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium">{p.planet}</td>
                  <td className="py-2">{p.sign} {(p.longitude % 30).toFixed(2)}°</td>
                  <td className="py-2">H{p.house}</td>
                  <td className="py-2">{p.nakshatra} P{p.pada}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.dignity === "exalted" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                      p.dignity === "debilitated" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                      p.dignity === "own" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
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

      {/* Current Dasha */}
      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Current Vimśottarī Daśā</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {report.dasha?.map((d: any) => {
            const isCurrent = d.startDate <= new Date() && d.endDate >= new Date();
            return (
              <div key={d.planet} className={`flex items-center justify-between p-3 rounded ${isCurrent ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                <div>
                  <span className="font-medium">{d.planet} Mahadasha</span>
                  <span className="ml-2 text-sm text-slate-500">{d.startDate.toLocaleDateString()} – {d.endDate.toLocaleDateString()}</span>
                </div>
                {isCurrent && <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded">Current</span>}
              </div>
            );
          })}
        </div>
      </details>

      {/* Problems & Remedies */}
      {report.problems && report.problems.length > 0 && (
        <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Astrological Conditions & Remedies</h4>
            <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
          </summary>
          <div className="px-4 pb-4 space-y-4">
            {report.problems.map((p: any) => (
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
      )}

      {/* Regional Info */}
      <details className="group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
          <h4 className="font-medium text-slate-900 dark:text-slate-100">Regional Context</h4>
          <span className="text-amber-500 transition-transform duration-200 group-open:rotate-180">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-2 text-sm">
          <div><span className="font-medium">Calendar:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.calendarType}</span></div>
          <div><span className="font-medium">New Year:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.newYear}</span></div>
          <div><span className="font-medium">Month Names:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.monthNames?.join(", ")}</span></div>
          <div><span className="font-medium">Key Festivals:</span> <span className="text-slate-600 dark:text-slate-400 ml-2">{report.regionalData?.festivals?.map((f: any) => f.name).join(", ")}</span></div>
        </div>
      </details>

      {/* Panchang */}
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
