"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Clock,
  Save,
  Printer,
  Database,
  Link2,
  AlertTriangle,
  Activity,
  PlusCircle,
} from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { DEFAULT_STOCK_ITEMS } from "@/types/inventory";
import type { StockItem } from "@/types/inventory";
import { calculateAutonomy } from "@/lib/calculations/dosification";
import { useSafeMutation, useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../../convex/_generated/api";

export default function StockPage() {
  const { toast, showToast } = useToast();

  /* State */
  const [lastSync, setLastSync] = useState("SIN REGISTROS");
  const [stock, setStock] = useState<StockItem[]>(
    DEFAULT_STOCK_ITEMS.map((s) => ({ ...s }))
  );
  const [entryForm, setEntryForm] = useState({
    productId: "PAC",
    newAmount: "",
    isCorrelated: true,
  });

  /* Convex mutations */
  const updateAmountMut = useSafeMutation(api.inventoryItems.updateAmount);
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);

  /* Convex queries */
  const inventoryItems = useSafeQuery(api.inventoryItems.getAll);
  const shiftRecords = useSafeQuery(api.shiftRecords.getAll);

  /* Global autonomy gauge */
  const globalAutonomy = useMemo(() => {
    const validItems = stock.filter((i) => i.amount > 0 && i.dailyConsumption > 0);
    if (validItems.length === 0) return 0;
    const total = stock.reduce((acc, curr) => {
      if (curr.amount <= 0 || curr.dailyConsumption <= 0) return acc;
      const days = curr.amount / curr.dailyConsumption;
      return acc + (days > 30 ? 100 : (days / 30) * 100);
    }, 0);
    return Math.min(100, total / stock.length);
  }, [stock]);

  /* SVG gauge calculations */
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (circumference * globalAutonomy) / 100;

  /* Add stock */
  const handleAddStock = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(entryForm.newAmount);
      if (isNaN(val) || val <= 0) return showToast("Ingrese una cantidad válida", "error");

      setStock((prev) =>
        prev.map((item) =>
          item.itemId === entryForm.productId
            ? {
                ...item,
                amount: item.amount + val,
                isCorrelated: entryForm.isCorrelated,
                lastUpdated: new Date().toISOString(),
              }
            : item
        )
      );

      const item = stock.find((s) => s.itemId === entryForm.productId);
      if (item && item._id) {
        try {
          await updateAmountMut({
            id: item._id as never,
            amount: item.amount + val,
            lastUpdated: new Date().toISOString(),
          });
        } catch {
          /* Convex not initialized yet, local only */
        }
      }

      try {
        await createBitacora({
          date: new Date().toISOString().split("T")[0],
          source: "Stock & Kardex",
          category: "Inventario",
          summary: `Carga de ${val} ${item?.unit || "kg"} de ${item?.itemName || entryForm.productId}`,
        });
      } catch {
        /* Convex not initialized */
      }

      setEntryForm({ ...entryForm, newAmount: "" });
      setLastSync(new Date().toLocaleString("es-ES"));
      showToast("Carga de inventario registrada", "success");
    },
    [entryForm, stock, updateAmountMut, createBitacora, showToast]
  );

  /* Enlazar Turno */
  const handleLinkShift = useCallback(() => {
    if (shiftRecords && shiftRecords.length > 0) {
      const latest = shiftRecords[0];
      setStock((prev) =>
        prev.map((item) => {
          const entry = latest.dosificationEntries.find(
            (d: NonNullable<typeof latest.dosificationEntries>[number]) => d.product === item.itemId || d.product === item.itemName
          );
          if (entry && entry.doseResult > 0) {
            const dailyCons =
              (entry.doseResult * (latest.plantFlowRef || 0) * 3.6 * latest.operationHours) / 1000;
            return { ...item, dailyConsumption: Math.round(dailyCons * 100) / 100, isCorrelated: true };
          }
          return item;
        })
      );
      setLastSync(new Date().toLocaleString("es-ES"));
      showToast("Sincronización con Hoja Operativa exitosa", "success");
    } else {
      showToast("No hay datos de turno disponibles", "info");
    }
  }, [shiftRecords, showToast]);

  /* PDF report */
  const handlePdf = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) return;
    const dateStr = new Date().toLocaleString("es-ES");
    const rows = stock
      .map(
        (item) => `
      <tr>
        <td style="text-align:left;font-weight:bold;padding:8px;border-bottom:1px solid #e2e8f0">${item.itemName}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.amount.toLocaleString("es-ES")} ${item.unit}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.dailyConsumption > 0 ? item.dailyConsumption + " kg/día" : "N/D"}</td>
        <td style="font-weight:bold;color:${item.amount <= 0 ? "#e11d48" : "#0f172a"};padding:8px;border-bottom:1px solid #e2e8f0">
          ${calculateAutonomy(item.amount, item.dailyConsumption).toFixed(1)} Días
        </td>
      </tr>`
      )
      .join("");
    w.document.write(`<html><head><title>Reporte Stock PTAP</title>
      <style>body{font-family:sans-serif;padding:40px;color:#0a192f}
      .header{border-bottom:2px solid #e11d48;padding-bottom:10px;margin-bottom:20px;display:flex;justify-content:space-between}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th{background:#0a192f;color:white;padding:10px;font-size:11px;text-transform:uppercase}
      td{text-align:center;font-size:12px}</style></head><body>
      <div class="header"><div><h1>TERA<span style="color:#f472b6">H20</span></h1><p>Control de Inventario Planta</p></div>
      <div><p>Emisión: ${dateStr}</p></div></div>
      <table><thead><tr><th>Insumo</th><th>Stock</th><th>Consumo</th><th>Autonomía</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }, [stock]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-navy-deep text-white shadow-2xl border-b-4 border-fuchsia-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/operaciones"
              className="p-3 bg-white/10 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-fuchsia-400" />
            </Link>
            <div className="p-3 bg-fuchsia-600 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">
                Autonomía y <span className="text-fuchsia-400">Stock PTAP</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3 text-fuchsia-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Última Act: <span className="text-white">{lastSync}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NavbarUser />
            <button
              onClick={handlePdf}
              className="bg-navy-light hover:bg-slate-700 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-slate-600 shadow-lg"
            >
              <Printer className="w-4 h-4 text-fuchsia-400" />
              <span className="text-[10px] font-black uppercase">Reporte PDF</span>
            </button>
            <button
              onClick={handleLinkShift}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-fuchsia-400"
            >
              <Database className="w-4 h-4 text-white" />
              <span className="text-[10px] font-black uppercase">Enlazar Turno</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Sidebar — Gauge */}
        <section className="lg:col-span-4">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 lg:sticky lg:top-[110px]">
            <h2 className="font-black uppercase text-xs flex items-center gap-2 mb-6 text-slate-400">
              <Package className="w-4 h-4 text-fuchsia-600" />
              Reserva de Planta
            </h2>

            <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="transparent"
                  stroke={globalAutonomy < 1 ? "#cbd5e1" : "#d946ef"}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-3xl font-black italic text-slate-800">
                  {Math.round(globalAutonomy)}%
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase leading-tight">
                  Estado de Carga
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Conexión de Datos
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                La autonomía permanece en cero hasta recibir el dato de dosis diaria desde la hoja de turno.
              </p>
            </div>
          </div>
        </section>

        {/* Main Panel */}
        <section className="lg:col-span-8 space-y-6">
          {/* Kardex */}
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <h2 className="text-sm font-black uppercase italic flex items-center gap-2 mb-6 text-slate-600">
              <Activity className="w-4 h-4 text-emerald-500" />
              Kardex Maestro
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stock.map((item) => {
                const days = calculateAutonomy(item.amount, item.dailyConsumption);
                const noStock = item.amount <= 0;
                return (
                  <div
                    key={item.itemId}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      noStock
                        ? "bg-slate-50 border-slate-100 shadow-inner"
                        : "bg-white border-transparent shadow-md"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">
                          {item.itemId}
                        </p>
                        <h3 className="font-bold text-slate-800 text-sm">{item.itemName}</h3>
                      </div>
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          item.isCorrelated
                            ? "bg-fuchsia-500 text-white"
                            : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        <Link2 className="w-2 h-2" />
                        {item.isCorrelated ? "Enlazado" : "Pendiente"}
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">
                          Masa Disponible
                        </p>
                        <p
                          className={`text-2xl font-black leading-none ${
                            noStock ? "text-slate-300" : "text-navy-deep"
                          }`}
                        >
                          {item.amount.toLocaleString("es-ES")}{" "}
                          <span className="text-xs font-medium text-slate-400">{item.unit}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 italic">
                          Días Autonomía
                        </p>
                        <p
                          className={`text-xl font-black font-mono leading-none ${
                            days <= 0 ? "text-slate-300" : "text-emerald-600"
                          }`}
                        >
                          {days > 0 ? days.toFixed(1) : "0"}
                        </p>
                      </div>
                    </div>

                    {item.dailyConsumption > 0 && (
                      <p className="text-[9px] text-slate-400 font-medium mt-2">
                        Consumo: {item.dailyConsumption} kg/día
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Entry form */}
          <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-navy-deep">
            <h3 className="text-xs font-black text-navy-deep flex items-center gap-2 uppercase tracking-tighter mb-6">
              <PlusCircle className="w-4 h-4 text-fuchsia-600" />
              Cargar Suministros (Ingreso Manual de Stock)
            </h3>

            <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1 italic">
                  Insumo
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-fuchsia-500"
                  value={entryForm.productId}
                  onChange={(e) => setEntryForm({ ...entryForm, productId: e.target.value })}
                >
                  {stock.map((item) => (
                    <option key={item.itemId} value={item.itemId}>
                      {item.itemName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1 italic">
                  Masa a Sumar
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-fuchsia-500 font-mono"
                  value={entryForm.newAmount}
                  onChange={(e) => setEntryForm({ ...entryForm, newAmount: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-center">
                <label className="flex items-center gap-2 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={entryForm.isCorrelated}
                    onChange={(e) =>
                      setEntryForm({ ...entryForm, isCorrelated: e.target.checked })
                    }
                    className="w-4 h-4 text-fuchsia-600 rounded"
                  />
                  <span className="text-[9px] font-black text-slate-500 uppercase">
                    Enlazar Registro
                  </span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-navy-deep text-white font-black py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 uppercase text-[9px] tracking-widest"
                >
                  <Save className="w-3.5 h-3.5 text-fuchsia-400" />
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <Footer />
      <Toast {...toast} />
    </div>
  );
}
