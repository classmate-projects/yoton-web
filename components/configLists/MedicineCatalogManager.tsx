"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import SearchIcon from "@/public/icons/SearchIcon";
import { PharmacyService } from "@/services/pharmacy.service";
import { MedicineBulkRow, MedicineType } from "@/types/pharmacy.type";
import { formatCurrency } from "@/lib/currency";

// Normalizes a header cell for loose, case-insensitive matching against the real DDC/
// Riayati export files (their exact column names, not something we control), e.g.
// "Suggested Route of Admin" and "ROUTE_OF_ADMIN" both need to resolve to "route".
const normalize = (key: string) => key.trim().toLowerCase().replace(/[\s_]+/g, " ").trim();

// DDC's STATUS column reads like "Discontinued on 2013.06.01" or
// "Grace (to be discontinued on 2026.09.03)" — both count as discontinued (the grace
// period still means it's on the way out), with the date extracted when present.
const parseDdcStatus = (status: string): { isDiscontinued: boolean; discontinuedDate?: string } => {
  const isDiscontinued = /discontinued/i.test(status);
  const match = status.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  return {
    isDiscontinued,
    discontinuedDate: match ? `${match[1]}-${match[2]}-${match[3]}` : undefined,
  };
};

const parseRiayatiDiscontinueDate = (raw: unknown): { isDiscontinued: boolean; discontinuedDate?: string } => {
  const value = String(raw ?? "").trim();
  if (!value || value.toUpperCase() === "NULL") return { isDiscontinued: false };
  const date = new Date(value);
  return {
    isDiscontinued: true,
    discontinuedDate: Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10),
  };
};

// Parses one source file's rows into the shared MedicineBulkRow shape. DDC and Riayati use
// entirely different column names for the same concepts, so each gets its own field-finder
// rather than trying to force one generic alias list to cover both real-world schemas.
const parseRows = (raw: Record<string, unknown>[], source: "DDC" | "Riayati"): MedicineBulkRow[] => {
  return raw
    .map((row) => {
      const entries = Object.entries(row).map(([k, v]) => [normalize(k), v] as const);
      const find = (...keys: string[]) => entries.find(([k]) => keys.includes(k))?.[1];

      if (source === "DDC") {
        const status = String(find("status") ?? "");
        const { isDiscontinued, discontinuedDate } = parseDdcStatus(status);
        const price = Number(find("package price"));
        return {
          code: String(find("ddc code") ?? "").trim() || undefined,
          name: String(find("trade name") ?? "").trim(),
          genericName: String(find("scientific name") ?? "").trim() || undefined,
          ingredient: String(find("ingredient strength") ?? "").trim() || undefined,
          dosageForm: String(find("dosage form package") ?? "").trim() || undefined,
          route: String(find("route of admin") ?? "").trim() || undefined,
          manufacturer: String(find("manufacturer") ?? "").trim() || undefined,
          price: Number.isNaN(price) ? undefined : price,
          isControlled: false,
          isDiscontinued,
          discontinuedDate,
        } satisfies MedicineBulkRow;
      }

      const isControlled = String(find("is controlled") ?? "").trim().toUpperCase() === "Y";
      const { isDiscontinued, discontinuedDate } = parseRiayatiDiscontinueDate(find("discontinue date"));
      const price = Number(find("price"));
      const ingredients = String(find("ingredients") ?? "").trim();
      const strength = String(find("strength") ?? "").trim();
      return {
        code: String(find("code") ?? "").trim() || undefined,
        name: String(find("display") ?? "").trim(),
        genericName: String(find("generic name") ?? "").trim() || undefined,
        ingredient: [ingredients, strength].filter(Boolean).join(" ") || undefined,
        dosageForm: String(find("dosage form") ?? "").trim() || undefined,
        route: String(find("suggested route of admin") ?? "").trim() || undefined,
        manufacturer: String(find("manufacturer") ?? "").trim() || undefined,
        price: Number.isNaN(price) ? undefined : price,
        isControlled,
        isDiscontinued,
        discontinuedDate,
      } satisfies MedicineBulkRow;
    })
    .filter((row) => row.name);
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message || fallback;
  }
  return fallback;
};

// Admin-only bulk import of the DDC and Riayati medication registry exports into the
// pharmacy's Medicine catalog, plus a read-only browse/search view — the Configurable Lists
// counterpart to the Procedure/CPT tab, but for medications. Day-to-day stock, pricing
// overrides, high-risk flagging, and alternatives stay on the Pharmacy page (that's
// pharmacist operational work, not catalog curation, hence the separate module gate).
export default function MedicineCatalogManager() {
  const [source, setSource] = useState<"DDC" | "Riayati">("Riayati");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<MedicineBulkRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const [items, setItems] = useState<MedicineType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "DDC" | "Riayati" | "none">("");
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter]);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await PharmacyService.getMedicines({
        search: debouncedSearch || undefined,
        source: sourceFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.data || []);
      setTotalCount(res.totalCount ?? 0);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load medicine catalog"));
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sourceFilter, page]);

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setSkipped(0);
  };

  const handleFile = async (selected: File) => {
    try {
      setIsParsing(true);
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = parseRows(raw, source);

      if (parsed.length === 0) {
        toast.error(
          source === "DDC"
            ? 'No usable rows found — the file needs a "TRADE_NAME" column'
            : 'No usable rows found — the file needs a "DISPLAY" column'
        );
        clearFile();
        return;
      }

      setFile(selected);
      setRows(parsed);
      setSkipped(raw.length - parsed.length);
    } catch {
      toast.error("Could not read that file — please upload a .xlsx, .xls, or .csv file");
      clearFile();
    } finally {
      setIsParsing(false);
    }
  };

  // Fire-and-forget, chunked at 1000 rows/request with a persistent progress toast — same
  // pattern as ListItemManager.uploadExcelInBackground, so a 20k+ row Riayati import doesn't
  // block the admin from continuing to work elsewhere while it runs.
  const runUpload = () => {
    if (rows.length === 0) return;
    const pending = rows;
    const uploadSource = source;
    clearFile();

    void (async () => {
      const CHUNK_SIZE = 1000;
      const toastId = `medicine-bulk-upload-${uploadSource}`;
      const total = pending.length;
      let inserted = 0;
      let updated = 0;
      let failed = 0;

      toast.loading(`Uploading ${uploadSource} medications… 0 / ${total}`, { id: toastId, duration: Infinity });

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = pending.slice(i, i + CHUNK_SIZE);
        try {
          const res = await PharmacyService.bulkUploadMedicines({ source: uploadSource, items: chunk });
          inserted += res.data?.inserted ?? 0;
          updated += res.data?.updated ?? 0;
        } catch {
          failed += chunk.length;
        }
        toast.loading(`Uploading ${uploadSource} medications… ${inserted + updated + failed} / ${total}`, {
          id: toastId,
          duration: Infinity,
        });
      }

      if (failed === 0) {
        toast.success(`${inserted} added, ${updated} updated`, { id: toastId, duration: 5000 });
      } else {
        toast.error(`${inserted} added, ${updated} updated, ${failed} failed — check the file and re-upload`, {
          id: toastId,
          duration: 8000,
        });
      }

      await fetchItems();
    })();
  };

  return (
    <>
      <div className="card p-6 mb-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/90">Bulk Upload Medications</h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Upload the DDC or Riayati medication registry export as-is — columns are matched automatically.
          Re-uploading a refreshed file updates existing entries (matched by code) in place; stock levels,
          pricing overrides, and high-risk flags set on the Pharmacy page are never touched by an import.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => { setSource("Riayati"); clearFile(); }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              source === "Riayati" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Riayati Medication Codes
          </button>
          <button
            onClick={() => { setSource("DDC"); clearFile(); }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              source === "DDC" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            DDC Release (Public)
          </button>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
          <FileSpreadsheet size={22} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {isParsing ? "Reading file…" : `Click to choose the ${source} .xlsx, .xls, or .csv export`}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
              e.target.value = "";
            }}
          />
        </label>

        {file && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
            <div className="text-xs text-foreground/90">
              <span className="font-semibold">{file.name}</span> — {rows.length} row(s) ready
              {skipped > 0 && <span className="text-muted-foreground"> ({skipped} skipped, missing a name)</span>}
            </div>
            <button onClick={clearFile} className="text-xs font-semibold text-muted-foreground hover:text-red-500">
              Remove
            </button>
          </div>
        )}

        <button
          onClick={runUpload}
          disabled={rows.length === 0}
          className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Upload size={15} /> Upload {rows.length || ""} Medication(s)
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground/90">Medication Catalog</h2>
          <div className="flex gap-2">
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <SearchIcon color="#555" />
              </span>
              <input
                type="text"
                placeholder="Search medications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "" | "DDC" | "Riayati" | "none")}
              className="h-10 text-sm"
            >
              <option value="">All sources</option>
              <option value="DDC">DDC</option>
              <option value="Riayati">Riayati</option>
              <option value="none">Manually added</option>
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Source</th>
              <th>Manufacturer</th>
              <th>Route</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-muted-foreground">
                  {debouncedSearch ? `No medications match "${debouncedSearch}".` : "No medications uploaded yet."}
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.medicineId}>
                  <td className="font-semibold">
                    {m.name}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.isControlled && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Controlled</span>
                      )}
                      {m.isDiscontinued && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">Discontinued</span>
                      )}
                    </div>
                  </td>
                  <td>{m.code || "—"}</td>
                  <td className="text-foreground/80">{m.source || "Manual"}</td>
                  <td className="text-foreground/80">{m.manufacturer || "—"}</td>
                  <td className="text-foreground/80">{m.route || "—"}</td>
                  <td className="text-foreground/80">{formatCurrency(m.price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            {totalCount === 0
              ? "0 results"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
