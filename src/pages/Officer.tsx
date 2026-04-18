import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, LogIn, RefreshCw, Send, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AppNav } from "@/components/dashboard/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchIncidents, fetchDatasetRange } from "@/lib/api";
import type { Incident } from "@/lib/dataset";
import { toast } from "@/hooks/use-toast";

const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const severityStyle: Record<Incident["severity"], string> = {
  LOW: "bg-status-good-soft text-status-good ring-status-good/20",
  MEDIUM: "bg-status-moderate-soft text-status-moderate ring-status-moderate/20",
  HIGH: "bg-status-hazardous-soft text-status-hazardous ring-status-hazardous/20",
};

const DEMO_EMAIL = "officer.demo@gpcb.gov.in";
const DEMO_PASSWORD = "demo-officer-2025";

const Officer = () => {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hours, setHours] = useState(720); // 30 days — meaningful for a 2024–2026 dataset

  const load = async (h = hours) => {
    setLoading(true);
    setIncidents(await fetchIncidents(h));
    setLoading(false);
  };

  useEffect(() => {
    if (!authed) return;
    load(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, authed]);

  const handleDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setTimeout(() => {
      setAuthed(true);
      toast({ title: "Demo session started", description: "Signed in as demo officer." });
    }, 250);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      setAuthed(true);
      toast({ title: "Signed in", description: "Welcome back, officer." });
    } else {
      toast({
        title: "Demo only",
        description: "Use “Go for Demo” — real authentication coming soon.",
        variant: "destructive",
      });
    }
  };

  /** Mirrors the PDF produced by app.py: title, summary stats, then per-incident detail. */
  const buildPdf = async () => {
    const range = await fetchDatasetRange();
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // --- title block
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text("Pollution Intelligence Summary Report", 14, 14);
    doc.setFontSize(9);
    doc.text("Maninagar, Ahmedabad — GPCB · CAAQMS", 14, 19);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    const windowLine = incidents.length
      ? `Selection window: ${fmtDateTime(incidents[incidents.length - 1].from)}  to  ${fmtDateTime(incidents[0].to)}`
      : range
        ? `Dataset window: ${fmtDateTime(range.start)}  to  ${fmtDateTime(range.end)}`
        : "Data window: -";
    doc.text(`Generated: ${fmtDateTime(new Date())}`, 14, 30);
    doc.text(windowLine, 14, 36);
    doc.text(`Incidents in selection: ${incidents.length}`, 14, 42);

    // --- summary
    const causeCount = new Map<string, number>();
    const zoneCount = new Map<string, number>();
    const sevCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const i of incidents) {
      causeCount.set(i.category, (causeCount.get(i.category) ?? 0) + 1);
      zoneCount.set(i.zone, (zoneCount.get(i.zone) ?? 0) + 1);
      sevCount[i.severity] += 1;
    }
    const topCause = [...causeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
    const topZone = [...zoneCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`- Total Major Incidents: ${incidents.length}`, 14, 59);
    doc.text(`- Most Common Cause: ${topCause}`, 14, 65);
    doc.text(`- Most Affected Zone: ${topZone}`, 14, 71);
    doc.text(
      `- Severity breakdown - HIGH: ${sevCount.HIGH}, MEDIUM: ${sevCount.MEDIUM}, LOW: ${sevCount.LOW}`,
      14,
      77,
    );

    // --- incidents table
    autoTable(doc, {
      startY: 84,
      head: [["ID", "From", "To", "Hrs", "Pollutants", "Wind", "Zone", "Cause", "Sev"]],
      body: incidents.slice(0, 60).map((i) => [
        i.id,
        fmtDateTime(i.from),
        fmtDateTime(i.to),
        String(i.durationHours),
        i.pollutants.join(", "),
        i.wind,
        i.zone,
        i.category,
        i.severity,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: { 4: { cellWidth: 32 }, 7: { cellWidth: 32 } },
    });

    // --- per-incident detail (mirrors app.py "Incident i" blocks)
    const detailIncidents = incidents.slice(0, 20);
    if (detailIncidents.length) {
      doc.addPage();
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageW, 16, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("Incident Detail (top 20)", 14, 11);
      doc.setTextColor(20, 20, 20);

      let y = 24;
      detailIncidents.forEach((e, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 16;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Incident ${idx + 1} — ${e.id}`, 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const lines = [
          `Time: ${fmtDateTime(e.from)}  to  ${fmtDateTime(e.to)}`,
          `Duration: ${e.durationHours} hours`,
          `Exceeded Pollutants: ${e.pollutants.join(", ")}`,
          `Severity: ${e.severity}`,
          `Wind Direction: ${e.wind}  ·  Likely Zone: ${e.zone}`,
          `Probable Cause: ${e.category}`,
        ];
        for (const ln of lines) {
          doc.text(ln, 16, y);
          y += 4.5;
        }
        y += 3;
      });
    }

    // footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `AirWatch · Maninagar CAAQMS · Page ${p}/${pages}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: "center" },
      );
    }

    doc.save(`maninagar-pollution-report-${Date.now()}.pdf`);
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await buildPdf();
      toast({
        title: "Report downloaded",
        description: `${incidents.length} incident(s) included from CPCB Maninagar dataset.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "PDF generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitToGPCB = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    toast({
      title: "Submitted to GPCB (demo)",
      description: `${incidents.length} incident event(s) queued for delivery to GPCB.`,
    });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader station="Officer Console" updatedAt="just now" />
        <main className="container py-8 sm:py-12 flex justify-center">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-card p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Officer Sign-in</h1>
                <p className="text-xs text-muted-foreground">
                  Restricted access — Sarpanch / Municipal Officer
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="officer@city.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                <LogIn className="h-4 w-4 mr-2" /> Sign in
              </Button>
            </form>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={handleDemo}>
              Go for Demo
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Demo auto-fills credentials. Real authentication is coming soon.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader station="Officer Console" updatedAt="just now" />
      <main className="container py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        <AppNav />

        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Sarpanch / Municipal Officer
            </h1>
            <p className="text-sm text-muted-foreground">
              Detected pollution incidents from CPCB Maninagar data — exceedances merged into events.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={24}>Last 24h</option>
              <option value={168}>Last 7d</option>
              <option value={720}>Last 30d</option>
              <option value={2160}>Last 90d</option>
              <option value={8760}>Last 1y</option>
              <option value={999999}>All time</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSubmitToGPCB}
              disabled={submitting || incidents.length === 0}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit to GPCB
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={generating || incidents.length === 0}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download PDF Report
            </Button>
          </div>
        </header>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-xs text-primary">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Live data: <strong>CPCB Maninagar 15-min CAAQMS dataset</strong> (Jan 2024 — Apr 2026).
            Thresholds, classification & severity match the Python pipeline.
          </span>
        </div>

        <section className="rounded-xl border border-border bg-card shadow-card">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Pollution Incidents</h2>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading…" : `${incidents.length} incident(s) in the selected window`}
              </p>
            </div>
          </header>

          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <table className="w-full border-separate border-spacing-y-1.5 text-sm px-4 py-3">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="font-medium px-3 py-2">ID</th>
                    <th className="font-medium px-3 py-2">From</th>
                    <th className="font-medium px-3 py-2">Duration</th>
                    <th className="font-medium px-3 py-2">Pollutants</th>
                    <th className="font-medium px-3 py-2">Zone</th>
                    <th className="font-medium px-3 py-2">Cause</th>
                    <th className="font-medium px-3 py-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No incidents detected in this window.
                      </td>
                    </tr>
                  )}
                  {incidents.slice(0, 200).map((i) => (
                    <tr key={i.id} className="bg-secondary/40 hover:bg-secondary transition-colors">
                      <td className="px-3 py-2.5 rounded-l-lg font-medium tabular-nums text-xs">{i.id}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {fmtDateTime(i.from)}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">{i.durationHours}h</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-muted-foreground">{i.pollutants.join(", ")}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{i.zone}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{i.category}</td>
                      <td className="px-3 py-2.5 rounded-r-lg">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                            severityStyle[i.severity],
                          )}
                        >
                          {i.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {incidents.length > 200 && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  Showing first 200 of {incidents.length}. Full list is included in the PDF.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Officer;
