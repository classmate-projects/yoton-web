"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageCheck, PackageOpen, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import type { IssueSummary, RequisitionSummary, StockRow, TransferSummary } from "@/types/inventory.type";
import { IssueDetail, IssueForm, RequisitionDetail, RequisitionForm, TransferDetail, TransferForm } from "@/components/inventory/Movements";
import ItemStockDetail from "@/components/inventory/ItemStockDetail";
import { DocStatus, InventoryProvider, day, inputClass, primaryButton, qty, secondaryButton, stamp, useInventory } from "@/components/inventory/inventoryUi";

type Tab = "stock" | "requests" | "incoming" | "use";

function StoreRequestsInner() {
  const { myStores, stores } = useInventory();
  const [storeId, setStoreId] = useState("");
  const [tab, setTab] = useState<Tab>("stock");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<RequisitionSummary[]>([]);
  const [incoming, setIncoming] = useState<TransferSummary[]>([]);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"request" | "issue" | "return" | null>(null);
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [openTransfer, setOpenTransfer] = useState<string | null>(null);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<StockRow | null>(null);
  const store = stores.find((s) => s.storeId === storeId) ?? null;

  useEffect(() => {
    // Store-team users see every store; start them on a department store rather than the main one.
    if (!storeId && myStores.length > 0) setStoreId((myStores.find((s) => s.supplyingStoreId) ?? myStores[0]).storeId);
  }, [myStores, storeId]);

  const load = useCallback(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    Promise.all([
      InventoryService.stock({ storeId }).then((r) => setStock(r.data)),
      InventoryService.requisitions({ storeId, direction: "outgoing" }).then((r) => setRequests(r.data.filter((x) => x.requestingStoreId === storeId))),
      InventoryService.transfers({ storeId, status: "InTransit" }).then((r) => setIncoming(r.data.filter((t) => t.toStoreId === storeId))),
      InventoryService.issues({ storeId }).then((r) => setIssues(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  const receive = async (t: TransferSummary) => {
    try {
      const res = await InventoryService.receiveTransfer(t.transferId);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't receive it"));
    }
  };

  if (myStores.length === 0 && !loading) {
    return (
      <div className="mainPage">
        <EmptyState illustration="pharmacy" title="Your department has no store yet" description="Ask the store team to set one up for your department in Inventory → Stores." />
      </div>
    );
  }

  const shown = stock.filter((r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()) || r.code.toLowerCase().includes(search.trim().toLowerCase()));
  const lowCount = stock.filter((r) => r.isLow).length;

  return (
    <div className="mainPage flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PackageOpen className="text-primary" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Store Requests</h1>
            <p className="text-sm text-muted-foreground">
              Your department&apos;s store{store?.supplyingStoreName ? ` - supplied by ${store.supplyingStoreName}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {myStores.length > 1 && (
            <div className="w-56">
              <SearchableSelect value={storeId} onChange={setStoreId} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={standaloneSelectClass} preserveCase />
            </div>
          )}
          <button type="button" onClick={() => setDialog("return")} disabled={!store?.supplyingStoreId} className={secondaryButton}>
            <Undo2 size={15} /> Send back
          </button>
          <button type="button" onClick={() => setDialog("issue")} className={secondaryButton}>
            <Plus size={15} /> Record use
          </button>
          <button type="button" onClick={() => setDialog("request")} disabled={!store?.supplyingStoreId} className={primaryButton}>
            <Plus size={15} /> Request stock
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["stock", `Stock${lowCount ? ` (${lowCount} low)` : ""}`],
            ["requests", `My requests (${requests.filter((r) => r.status === "Submitted" || r.status === "PartiallyIssued").length} open)`],
            ["incoming", `Incoming (${incoming.length})`],
            ["use", "Used stock"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === "stock" ? (
        <div className="flex flex-col gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item…" className={`${inputClass} w-72`} />
          {shown.length === 0 ? (
            <EmptyState illustration="pharmacy" title="No stock here yet" description="Request stock from your supplying store." size="compact" />
          ) : (
            <div className="card">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">In stock</th>
                    <th className="text-right">Reorder level</th>
                    <th>Nearest expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.itemId} className="cursor-pointer" onClick={() => setOpenItem(r)}>
                      <td>
                        <span className="font-medium text-foreground">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">{r.code}</span>
                      </td>
                      <td className={`text-right tabular-nums ${r.isLow ? "font-semibold text-amber-600" : ""}`}>
                        {qty(r.quantity)} {r.unit}
                      </td>
                      <td className="text-right tabular-nums">{r.reorderLevel > 0 ? qty(r.reorderLevel) : "—"}</td>
                      <td className={r.expiredQuantity > 0 ? "text-red-600" : ""}>
                        {r.expiredQuantity > 0 ? `${qty(r.expiredQuantity)} expired` : day(r.nextExpiry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === "requests" ? (
        requests.length === 0 ? (
          <EmptyState illustration="clipboard" title="No requests yet" size="compact" action={store?.supplyingStoreId ? { label: "Request stock", onClick: () => setDialog("request") } : undefined} />
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.requisitionId} className="cursor-pointer" onClick={() => setOpenReq(r.requisitionId)}>
                    <td className="font-medium text-foreground">
                      {r.number}
                      {r.priority === "Urgent" && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Urgent</span>}
                    </td>
                    <td>
                      <DocStatus status={r.status} />
                    </td>
                    <td>{r.lineCount}</td>
                    <td>
                      {r.requestedByName}
                      <span className="block text-xs text-muted-foreground">{stamp(r.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "incoming" ? (
        incoming.length === 0 ? (
          <EmptyState illustration="done" title="Nothing on its way" size="compact" />
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>From</th>
                  <th>For request</th>
                  <th>Dispatched</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {incoming.map((t) => (
                  <tr key={t.transferId}>
                    <td>
                      <button type="button" onClick={() => setOpenTransfer(t.transferId)} className="font-medium text-primary hover:underline">
                        {t.number}
                      </button>
                    </td>
                    <td>{t.fromStoreName}</td>
                    <td>{t.requisitionNumber ?? "—"}</td>
                    <td>
                      {t.dispatchedByName}
                      <span className="block text-xs text-muted-foreground">{stamp(t.dispatchedAt)}</span>
                    </td>
                    <td className="text-right">
                      <button type="button" onClick={() => receive(t)} className={primaryButton}>
                        <PackageCheck size={15} /> Confirm received
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : issues.length === 0 ? (
        <EmptyState illustration="clipboard" title="No use recorded yet" size="compact" action={{ label: "Record use", onClick: () => setDialog("issue") }} />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Purpose</th>
                <th>Handed to</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.issueId} className="cursor-pointer" onClick={() => setOpenIssue(i.issueId)}>
                  <td className="font-medium text-foreground">{i.number}</td>
                  <td>{i.purpose ?? "—"}</td>
                  <td>{i.issuedTo ?? "—"}</td>
                  <td>
                    {i.issuedByName}
                    <span className="block text-xs text-muted-foreground">{stamp(i.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog === "request" && (
        <RequisitionForm
          requestingStore={store}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            setTab("requests");
            setOpenReq(id);
            load();
          }}
        />
      )}
      {dialog === "issue" && (
        <IssueForm
          store={store}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setTab("use");
            load();
          }}
        />
      )}
      {dialog === "return" && (
        <TransferForm
          fromStore={store}
          isReturn
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load();
          }}
        />
      )}
      {openReq && <RequisitionDetail id={openReq} onClose={() => setOpenReq(null)} />}
      {openTransfer && <TransferDetail id={openTransfer} onClose={() => setOpenTransfer(null)} />}
      {openIssue && <IssueDetail id={openIssue} onClose={() => setOpenIssue(null)} />}
      {openItem && <ItemStockDetail itemId={openItem.itemId} row={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

// Department staff's view of their own department's store(s): what's in stock, asking the
// supplying store for more, confirming deliveries, recording what's used and sending stock
// back. Needs the Store Requests module; the stores shown are those of the user's department.
export default function StoreRequestsPage() {
  return (
    <InventoryProvider>
      <StoreRequestsInner />
    </InventoryProvider>
  );
}
