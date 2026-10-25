"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { InventoryService } from "@/services/inventory.service";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { InventoryItem, LedgerRow, StockLot, StockRow } from "@/types/inventory.type";
import BarcodeLabels, { type InventoryLabel } from "./BarcodeLabels";
import { Facts, Modal, Pager, TXN_LABELS, day, qty, secondaryButton, smallInputClass, stamp } from "./inventoryUi";

// One item: its lots in every store you can see, its item card (every movement, newest
// first), batch labels, and - for the selected store - its reorder level there.
export default function ItemStockDetail({ itemId, row, onClose }: { itemId: string; row?: StockRow | null; onClose: () => void }) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [tab, setTab] = useState<"lots" | "card">("lots");
  const [labels, setLabels] = useState<InventoryLabel[] | null>(null);
  const [level, setLevel] = useState(row ? String(row.reorderLevel) : "");
  const [levelQty, setLevelQty] = useState(row ? String(row.reorderQuantity) : "");
  const [savingLevel, setSavingLevel] = useState(false);

  const load = useCallback(() => {
    InventoryService.itemStock(itemId).then((r) => {
      setItem(r.data.item);
      setLots(r.data.lots);
    }).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the item")));
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    InventoryService.ledger({ itemId, storeId: row?.storeId, page: ledgerPage, pageSize: 50 })
      .then((r) => {
        setLedger(r.data);
        setLedgerTotal(r.total);
      })
      .catch(() => setLedger([]));
  }, [itemId, row?.storeId, ledgerPage]);

  const saveLevel = async () => {
    if (!row) return;
    setSavingLevel(true);
    try {
      const res = await InventoryService.saveLevel(row.storeId, itemId, Number(level) || 0, Number(levelQty) || 0);
      toast.success(res.message);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the level"));
    } finally {
      setSavingLevel(false);
    }
  };

  const labelFor = (l: StockLot): InventoryLabel => ({
    code: l.batchId,
    title: item?.name ?? "",
    lines: [`Batch ${l.batchNumber ?? "—"}${l.expiryDate ? ` · Exp ${day(l.expiryDate)}` : ""}`, `${item?.code ?? ""} · ${l.storeName ?? ""}`],
  });

  return (
    <Modal
      title={item?.name ?? "Item"}
      subtitle={item ? `${item.code} · ${item.itemType}${item.category ? ` · ${item.category}` : ""}` : undefined}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          {item && (
            <button type="button" className={secondaryButton} onClick={() => setLabels([{ code: item.code, title: item.name, lines: [item.code, item.unit] }])}>
              <Printer size={15} /> Item label
            </button>
          )}
          {lots.length > 0 && (
            <button type="button" className={secondaryButton} onClick={() => setLabels(lots.map(labelFor))}>
              <Printer size={15} /> Batch labels ({lots.length})
            </button>
          )}
        </>
      }
    >
      {!item ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              { label: "Total in stock", value: `${qty(item.totalStock)} ${item.unit}` },
              { label: "Bought as", value: item.purchaseUnit ? `${item.purchaseUnit} of ${qty(item.unitsPerPurchaseUnit)}` : item.unit },
              { label: "Last purchase cost", value: `${formatCurrency(item.lastPurchaseCost)} / ${item.unit}` },
              { label: "Default supplier", value: item.defaultVendorName ?? "—" },
            ]}
          />
          {row && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
              <div className="text-sm">
                <p className="font-semibold text-foreground">Reorder level in {row.storeName}</p>
                <p className="text-xs text-muted-foreground">Flag the item when stock here falls to this level. 0 / 0 uses the item&apos;s own level (main stores only).</p>
              </div>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Level ({item.unit})
                <input type="number" min={0} value={level} onChange={(e) => setLevel(e.target.value)} className={`${smallInputClass} w-28`} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Reorder quantity
                <input type="number" min={0} value={levelQty} onChange={(e) => setLevelQty(e.target.value)} className={`${smallInputClass} w-28`} />
              </label>
              <button type="button" onClick={saveLevel} disabled={savingLevel} className={secondaryButton}>
                <Save size={14} /> Save level
              </button>
            </div>
          )}

          <div className="flex gap-1 border-b border-border">
            {(["lots", "card"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t === "lots" ? `Batches (${lots.length})` : "Item card"}
              </button>
            ))}
          </div>

          {tab === "lots" ? (
            lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock in any store you can see.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-compact w-full text-sm">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Unit cost</th>
                      <th className="text-right">Value</th>
                      <th>Received</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l) => (
                      <tr key={l.batchId}>
                        <td>{l.storeName}</td>
                        <td>{l.batchNumber ?? "—"}</td>
                        <td className={l.isExpired ? "font-semibold text-red-600" : l.daysToExpiry != null && l.daysToExpiry <= 90 ? "text-amber-600" : ""}>
                          {l.expiryDate ? day(l.expiryDate) : "—"}
                          {l.isExpired && " (expired)"}
                        </td>
                        <td className="text-right tabular-nums">
                          {qty(l.quantity)} {item.unit}
                        </td>
                        <td className="text-right tabular-nums">{formatCurrency(l.unitCost)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(l.value)}</td>
                        <td>{stamp(l.receivedAt)}</td>
                        <td>
                          <button type="button" onClick={() => setLabels([labelFor(l)])} className="text-xs font-semibold text-primary hover:underline">
                            Label
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">No movements yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-compact w-full text-sm">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Movement</th>
                        <th>Document</th>
                        <th>Store</th>
                        <th>Batch</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Balance</th>
                        <th className="text-right">Value</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((t) => (
                        <tr key={t.transactionId}>
                          <td className="whitespace-nowrap">{stamp(t.createdAt)}</td>
                          <td>
                            {TXN_LABELS[t.txnType]}
                            {(t.departmentName || t.counterpartStoreName || t.vendorName) && (
                              <span className="block text-xs text-muted-foreground">{t.departmentName ?? t.counterpartStoreName ?? t.vendorName}</span>
                            )}
                            {t.reason && <span className="block text-xs text-muted-foreground">{t.reason}</span>}
                          </td>
                          <td className="whitespace-nowrap">{t.documentNumber}</td>
                          <td>{t.storeName}</td>
                          <td>{t.batchNumber ?? "—"}</td>
                          <td className={`whitespace-nowrap text-right tabular-nums font-semibold ${t.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                            {t.quantity > 0 ? "+" : ""}
                            {qty(t.quantity)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">{qty(t.balanceAfter)}</td>
                          <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(t.value)}</td>
                          <td>{t.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pager page={ledgerPage} pageSize={50} total={ledgerTotal} onPage={setLedgerPage} />
            </div>
          )}
        </div>
      )}
      {labels && <BarcodeLabels labels={labels} onClose={() => setLabels(null)} />}
    </Modal>
  );
}
