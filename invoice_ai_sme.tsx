import { useState, useRef, type CSSProperties } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type InvoiceStatus = "Paid" | "Pending" | "Overdue";
type Invoice = {
  id: number;
  vendor: string;
  number: string;
  date: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  category: string;
};
type ExtractedInvoice = {
  vendor?: string;
  number?: string;
  date?: string;
  dueDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  category?: string;
  items?: { description: string; quantity: number; unitPrice: number; total: number }[];
  error?: boolean;
};
type GeneratedInvoice = {
  client?: string;
  number?: string;
  date?: string;
  dueDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  category?: string;
  error?: boolean;
};

const INIT_INVOICES: Invoice[] = [
  { id: 1, vendor: "Amazon Web Services", number: "INV-001", date: "2026-01-15", dueDate: "2026-02-15", subtotal: 4500, tax: 810, total: 5310, status: "Paid", category: "Software" },
  { id: 2, vendor: "Office Depot", number: "INV-002", date: "2026-02-10", dueDate: "2026-03-10", subtotal: 1200, tax: 216, total: 1416, status: "Pending", category: "Supplies" },
  { id: 3, vendor: "DHL Logistics", number: "INV-003", date: "2026-02-20", dueDate: "2026-03-05", subtotal: 3200, tax: 576, total: 3776, status: "Overdue", category: "Logistics" },
  { id: 4, vendor: "Slack Technologies", number: "INV-004", date: "2026-03-01", dueDate: "2026-04-01", subtotal: 800, tax: 144, total: 944, status: "Paid", category: "Software" },
  { id: 5, vendor: "City Power Utility", number: "INV-005", date: "2026-03-15", dueDate: "2026-04-15", subtotal: 650, tax: 117, total: 767, status: "Pending", category: "Utilities" },
  { id: 6, vendor: "Freelance – John Doe", number: "INV-006", date: "2026-04-01", dueDate: "2026-04-30", subtotal: 2500, tax: 450, total: 2950, status: "Overdue", category: "Services" },
  { id: 7, vendor: "Zoom Video Comms", number: "INV-007", date: "2026-04-10", dueDate: "2026-05-10", subtotal: 300, tax: 54, total: 354, status: "Paid", category: "Software" },
  { id: 8, vendor: "FedEx Shipping", number: "INV-008", date: "2026-05-01", dueDate: "2026-06-01", subtotal: 1800, tax: 324, total: 2124, status: "Pending", category: "Logistics" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAT_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#14b8a6"];
const S_COLORS = { Paid: "#10b981", Pending: "#f59e0b", Overdue: "#ef4444" };

const fmtINR = (n: number | string | undefined) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: string | undefined) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

const inp: CSSProperties = { padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
const btn = (bg="#6366f1", disabled=false) => ({ padding: "11px 20px", background: disabled ? "#a5b4fc" : bg, color: "#fff", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 });

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [invoices, setInvoices] = useState(INIT_INVOICES);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GeneratedInvoice | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [genForm, setGenForm] = useState({ client: "", number: "", date: "", dueDate: "", items: [{ desc: "", qty: 1, rate: 0 }], tax: 18, notes: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const totalRevenue = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.total, 0);
  const overdue = invoices.filter(i => i.status === "Overdue").reduce((s, i) => s + i.total, 0);

  const monthlyData = MONTHS.map((m, idx) => {
    const ms = invoices.filter(i => new Date(i.date).getMonth() === idx);
    return { month: m, total: ms.reduce((s,i) => s + i.total, 0), count: ms.length };
  }).filter(m => m.count > 0);

  const catMap: Record<string, number> = {};
  invoices.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + i.total; });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  const statusData = ["Paid","Pending","Overdue"].map(name => ({ name, value: invoices.filter(i=>i.status===name).length }));

  const callAPI = async (messages: { role: string; content: unknown }[]) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages })
    });
    const data = await res.json();
    return data.content.map((b: { text?: string }) => b.text || "").join("");
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    setExtracting(true); setExtractedData(null);
    try {
      const b64 = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result;
          if (typeof result !== "string") return rej(new Error("Failed to read file"));
          res(result.split(",")[1]);
        };
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const block = file.type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
        : { type: "image", source: { type: "base64", media_type: file.type, data: b64 } };
      const text = await callAPI([{ role: "user", content: [block, { type: "text", text: `Extract all invoice data. Return ONLY a JSON object:
{"vendor":"","number":"","date":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","items":[{"description":"","quantity":0,"unitPrice":0,"total":0}],"subtotal":0,"tax":0,"total":0,"currency":"INR","category":"one of: Software,Logistics,Utilities,Services,Supplies,Marketing,Other","notes":""}
No markdown, no explanation.` }] }]);
      setExtractedData(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setExtractedData({ error: true }); }
    setExtracting(false);
  };

  const saveExtracted = () => {
    if (!extractedData || extractedData.error) return;
    setInvoices(p => [...p, { id: Date.now(), vendor: extractedData.vendor || "Unknown", number: extractedData.number || `INV-${Date.now()}`, date: extractedData.date || "", dueDate: extractedData.dueDate || "", subtotal: extractedData.subtotal || 0, tax: extractedData.tax || 0, total: extractedData.total || 0, status: "Pending", category: extractedData.category || "Other" }]);
    setExtractedData(null); setTab("tracker");
  };

  const handleGenerate = async () => {
    setGenerating(true); setGenResult(null);
    try {
      const sub = genForm.items.reduce((s, i) => s + (i.qty || 0) * (Number(i.rate) || 0), 0);
      const taxAmt = (sub * genForm.tax)/100;
      const text = await callAPI([{ role: "user", content: `Generate a structured invoice. Return ONLY JSON:
{"vendor":"My Company","client":"${genForm.client}","number":"${genForm.number}","date":"${genForm.date}","dueDate":"${genForm.dueDate}","subtotal":${sub},"tax":${taxAmt},"total":${sub+taxAmt},"category":"one of: Software,Logistics,Utilities,Services,Supplies,Marketing,Other","notes":"${genForm.notes}"}
No markdown, no explanation.` }]);
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      parsed.subtotal = sub; parsed.tax = taxAmt; parsed.total = sub+taxAmt;
      setGenResult(parsed);
    } catch { setGenResult({ error: true }); }
    setGenerating(false);
  };

  const saveGenerated = () => {
    if (!genResult || genResult.error) return;
    setInvoices(p => [...p, { id: Date.now(), vendor: genResult.client || genForm.client, number: genResult.number || genForm.number, date: genResult.date || genForm.date, dueDate: genResult.dueDate || genForm.dueDate, subtotal: genResult.subtotal ?? 0, tax: genResult.tax ?? 0, total: genResult.total ?? 0, status: "Pending", category: genResult.category || "Other" }]);
    setGenResult(null); setTab("tracker");
  };

  const TABS = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "extract", icon: "📤", label: "Extract Invoice" },
    { id: "generate", icon: "✍️", label: "Generate Invoice" },
    { id: "tracker", icon: "📋", label: "Payment Tracker" },
  ];

  const card = (label: string, value: string | number, color: string, bg: string) => (
    <div style={{ background: bg, borderRadius: 12, padding: "18px 20px", border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
    </div>
  );

  const sub = genForm.items.reduce((s, i) => s + (i.qty || 0) * (Number(i.rate) || 0), 0);
  const taxAmt = (sub * genForm.tax)/100;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter',sans-serif", background: "#f1f5f9", color: "#1e293b", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 210, background: "#1e1b4b", color: "#e0e7ff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #312e81" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#a5b4fc" }}>🧾 InvoiceAI</div>
          <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>SME Automation</div>
        </div>
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 18px", background: tab===t.id ? "#312e81" : "transparent", color: tab===t.id ? "#a5b4fc" : "#94a3b8", border: "none", borderLeft: tab===t.id ? "3px solid #6366f1" : "3px solid transparent", cursor: "pointer", fontSize: 13, fontWeight: tab===t.id ? 600 : 400 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 18px", borderTop: "1px solid #312e81", fontSize: 11, color: "#475569" }}>
          {invoices.length} invoices tracked
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>Analytics Dashboard</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              {card("Total Invoices", invoices.length, "#6366f1", "#eef2ff")}
              {card("Revenue Received", fmtINR(totalRevenue), "#10b981", "#ecfdf5")}
              {card("Outstanding", fmtINR(outstanding), "#f59e0b", "#fffbeb")}
              {card("Overdue", fmtINR(overdue), "#ef4444", "#fef2f2")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Monthly Invoice Volume</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmtINR(Number(v))} />
                    <Bar dataKey="total" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Payment Status</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={72} dataKey="value" label={({name,value}) => value > 0 ? `${name}: ${value}` : ""} labelLine={false} fontSize={11}>
                      {statusData.map((e,i) => <Cell key={i} fill={S_COLORS[e.name as InvoiceStatus]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Spending by Category</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={catData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={76} />
                  <Tooltip formatter={v => fmtINR(Number(v))} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {catData.map((_,i) => <Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* EXTRACT */}
        {tab === "extract" && (
          <div style={{ padding: 24, maxWidth: 780 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Extract Invoice</h2>
            <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: 13 }}>Upload a PDF or image — AI will parse all fields automatically.</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? "#6366f1" : "#cbd5e1"}`, borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "#eef2ff" : "#f8fafc", marginBottom: 20 }}>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div style={{ fontSize: 36, marginBottom: 10 }}>📎</div>
              <div style={{ fontWeight: 600, color: "#334155" }}>Drop invoice here or click to browse</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Supports PDF, PNG, JPG, JPEG</div>
            </div>
            {extracting && (
              <div style={{ background: "#eef2ff", borderRadius: 12, padding: 20, textAlign: "center", color: "#6366f1" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>AI is reading your invoice...</div>
                <div style={{ fontSize: 12, color: "#818cf8", marginTop: 3 }}>Extracting vendor, amounts, dates & line items</div>
              </div>
            )}
            {extractedData?.error && (
              <div style={{ background: "#fef2f2", color: "#ef4444", borderRadius: 12, padding: 16, textAlign: "center", fontWeight: 500 }}>
                ❌ Could not extract data. Please try a clearer image or PDF.
              </div>
            )}
            {extractedData && !extractedData.error && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>✅ Extracted Data</span>
                  <span style={{ background: "#eef2ff", color: "#6366f1", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{extractedData.category}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[["Vendor", extractedData.vendor],["Invoice #", extractedData.number],["Date", fmtDate(extractedData.date)],["Due Date", fmtDate(extractedData.dueDate)],["Subtotal", fmtINR(extractedData.subtotal)],["Tax", fmtINR(extractedData.tax)]].map(([l,v]) => (
                    <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#1e1b4b", color: "#a5b4fc", borderRadius: 8, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 600 }}>Total Amount</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{fmtINR(extractedData.total)}</span>
                </div>
                {(extractedData.items?.length ?? 0) > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                    <thead><tr style={{ background: "#f8fafc" }}>
                      {["Description","Qty","Unit Price","Total"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{extractedData.items!.map((it, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px" }}>{it.description}</td>
                        <td style={{ padding: "8px 12px" }}>{it.quantity}</td>
                        <td style={{ padding: "8px 12px" }}>{fmtINR(it.unitPrice)}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{fmtINR(it.total)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={saveExtracted} style={{ ...btn(), flex: 1 }}>💾 Save to Tracker</button>
                  <button onClick={() => setExtractedData(null)} style={{ ...btn("#94a3b8") }}>Discard</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GENERATE */}
        {tab === "generate" && (
          <div style={{ padding: 24, maxWidth: 680 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Generate Invoice</h2>
            <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: 13 }}>Fill in the details — AI will structure, validate, and categorize your invoice.</p>
            <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                {([["Client Name","client","text"],["Invoice Number","number","text"],["Invoice Date","date","date"],["Due Date","dueDate","date"]] as const).map(([label, key, type]) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 5 }}>{label}</label>
                    <input type={type} value={genForm[key]} onChange={e => setGenForm(p => ({ ...p, [key]: e.target.value }))} style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Line Items</label>
                  <button onClick={() => setGenForm(p => ({ ...p, items: [...p.items, { desc: "", qty: 1, rate: 0 }] }))}
                    style={{ background: "#eef2ff", color: "#6366f1", border: "none", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Add Item</button>
                </div>
                {genForm.items.map((item,i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 32px", gap: 8, marginBottom: 8 }}>
                    <input placeholder="Description" value={item.desc} onChange={e => setGenForm(p => { const it=[...p.items]; it[i].desc=e.target.value; return {...p,items:it}; })} style={{ ...inp, fontSize: 13 }} />
                    <input type="number" placeholder="Qty" value={item.qty} onChange={e => setGenForm(p => { const it=[...p.items]; it[i].qty=+e.target.value; return {...p,items:it}; })} style={{ ...inp, fontSize: 13 }} />
                    <input type="number" placeholder="Rate ₹" value={item.rate} onChange={e => setGenForm(p => { const it=[...p.items]; it[i].rate=+e.target.value; return {...p,items:it}; })} style={{ ...inp, fontSize: 13 }} />
                    <button onClick={() => setGenForm(p => ({ ...p, items: p.items.filter((_,j)=>j!==i) }))}
                      style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 5 }}>Tax %</label>
                  <input type="number" value={genForm.tax} onChange={e => setGenForm(p => ({ ...p, tax: +e.target.value }))} style={{ ...inp, width: 80 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 5 }}>Notes</label>
                  <input value={genForm.notes} placeholder="Optional..." onChange={e => setGenForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
                </div>
              </div>
              {sub > 0 && (
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
                  {[["Subtotal", fmtINR(sub)],["Tax ("+genForm.tax+"%)", fmtINR(taxAmt)]].map(([l,v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 4 }}><span>{l}</span><span>{v}</span></div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#1e293b", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                    <span>Total</span><span style={{ color: "#6366f1", fontSize: 15 }}>{fmtINR(sub+taxAmt)}</span>
                  </div>
                </div>
              )}
              <button onClick={handleGenerate} disabled={generating || !genForm.client} style={{ ...btn("#6366f1", generating||!genForm.client), width: "100%" }}>
                {generating ? "🤖 AI is generating..." : "✨ Generate with AI"}
              </button>
            </div>
            {genResult?.error && (
              <div style={{ background: "#fef2f2", color: "#ef4444", borderRadius: 12, padding: 16, textAlign: "center", fontWeight: 500 }}>❌ Generation failed. Please try again.</div>
            )}
            {genResult && !genResult.error && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>✅ Invoice Ready</span>
                  <span style={{ background: "#eef2ff", color: "#6366f1", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Category: {genResult.category}</span>
                </div>
                <div style={{ background: "#1e1b4b", color: "#a5b4fc", borderRadius: 8, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Invoice for {genResult.client||genForm.client}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{genResult.number||genForm.number}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtINR(genResult.total)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={saveGenerated} style={{ ...btn(), flex: 1 }}>💾 Save to Tracker</button>
                  <button onClick={() => setGenResult(null)} style={{ ...btn("#94a3b8") }}>Discard</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRACKER */}
        {tab === "tracker" && (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Payment Tracker</h2>
            <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: 13 }}>Manage all invoices and update their payment status.</p>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  {["Vendor","Invoice #","Date","Due Date","Category","Amount","Status","Update"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9", background: i%2===0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "11px 14px", fontWeight: 600 }}>{inv.vendor}</td>
                      <td style={{ padding: "11px 14px", color: "#6366f1", fontWeight: 500 }}>{inv.number}</td>
                      <td style={{ padding: "11px 14px", color: "#64748b" }}>{fmtDate(inv.date)}</td>
                      <td style={{ padding: "11px 14px", color: inv.status==="Overdue" ? "#ef4444" : "#64748b" }}>{fmtDate(inv.dueDate)}</td>
                      <td style={{ padding: "11px 14px" }}><span style={{ background: "#f1f5f9", padding: "2px 9px", borderRadius: 20, fontSize: 11, color: "#475569" }}>{inv.category}</span></td>
                      <td style={{ padding: "11px 14px", fontWeight: 600 }}>{fmtINR(inv.total)}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ background: inv.status==="Paid"?"#ecfdf5":inv.status==="Overdue"?"#fef2f2":"#fffbeb", color: S_COLORS[inv.status as InvoiceStatus], padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{inv.status}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <select value={inv.status} onChange={e => setInvoices(p => p.map(x => x.id===inv.id ? {...x, status: e.target.value as InvoiceStatus} : x))}
                          style={{ padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fff", outline: "none", cursor: "pointer" }}>
                          <option>Paid</option><option>Pending</option><option>Overdue</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
