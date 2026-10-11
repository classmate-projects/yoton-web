"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList, Eye, EyeOff, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  applyOrderSet,
  createOrderSet,
  deleteOrderSet,
  getApplicationsForEncounter,
  getOrderSetItems,
  getOrderSets,
  revertApplication,
} from "@/services/orderSet.service";
import { OrderSetApplicationDto, OrderSetDto, OrderSetItemDto } from "@/types/orderSet.type";
import { useCurrentEncounter } from "@/lib/currentEncounterContext";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import OrderSetEditor from "./OrderSetEditor";

type View =
  | { type: "list" }
  | { type: "editor"; orderSet: OrderSetDto; items: OrderSetItemDto[] }
  | { type: "revert"; orderSet: OrderSetDto; applications: OrderSetApplicationDto[] };

interface Props {
  onClose: () => void;
}

export default function OrderSetPanel({ onClose }: Props) {
  const { patientId, encounterId, visitId } = useCurrentEncounter();
  const inEncounter = !!(patientId && encounterId);

  const [view, setView] = useState<View>({ type: "list" });
  const [orderSets, setOrderSets] = useState<OrderSetDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Password dialog state for revert
  const [revertTarget, setRevertTarget] = useState<OrderSetApplicationDto | null>(null);
  const [revertPassword, setRevertPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    loadOrderSets();
  }, []);

  const loadOrderSets = async () => {
    try {
      setIsLoading(true);
      setOrderSets(await getOrderSets());
    } catch {
      toast.error("Failed to load order sets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setIsCreating(true);
      const created = await createOrderSet(newName.trim());
      setOrderSets((prev) => [created, ...prev]);
      setNewName("");
      setShowNewInput(false);
      toast.success("Order set created");
    } catch {
      toast.error("Failed to create order set");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (os: OrderSetDto) => {
    try {
      const items = await getOrderSetItems(os.orderSetId);
      setView({ type: "editor", orderSet: os, items });
    } catch {
      toast.error("Failed to load order set items");
    }
  };

  const handleApply = async (os: OrderSetDto) => {
    if (!patientId || !encounterId) return;
    try {
      setApplyingId(os.orderSetId);
      await applyOrderSet(os.orderSetId, patientId, encounterId, visitId);
      toast.success(`"${os.name}" applied`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to apply order set");
    } finally {
      setApplyingId(null);
    }
  };

  const handleShowRevert = async (os: OrderSetDto) => {
    if (!encounterId) return;
    try {
      const apps = await getApplicationsForEncounter(encounterId);
      const forThisSet = apps.filter((a) => a.orderSetId === os.orderSetId && !a.isReverted);
      if (forThisSet.length === 0) {
        toast.info(`"${os.name}" has not been applied to this encounter.`);
        return;
      }
      setView({ type: "revert", orderSet: os, applications: forThisSet });
    } catch {
      toast.error("Failed to load applications");
    }
  };

  const handleDelete = (os: OrderSetDto) => {
    confirmDeleteToast(`Delete "${os.name}"?`, async () => {
      try {
        await deleteOrderSet(os.orderSetId);
        setOrderSets((prev) => prev.filter((x) => x.orderSetId !== os.orderSetId));
        toast.success("Order set deleted");
      } catch {
        toast.error("Failed to delete order set");
      }
    });
  };

  const handleRevert = async () => {
    if (!revertTarget || !revertPassword) return;
    try {
      setIsReverting(true);
      await revertApplication(revertTarget.applicationId, revertPassword);
      toast.success("Order set reverted");
      setRevertTarget(null);
      setRevertPassword("");
      setView({ type: "list" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to revert");
    } finally {
      setIsReverting(false);
    }
  };

  const title =
    view.type === "editor"
      ? `Edit: ${view.orderSet.name}`
      : view.type === "revert"
      ? `Revert: ${view.orderSet.name}`
      : "Order Sets";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 sm:items-center sm:pt-4" onClick={onClose}>
        {/* Modal */}
        <div
          className="relative flex flex-col bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <ClipboardList size={18} className="text-primary shrink-0" />
            <span className="font-semibold text-sm flex-1 truncate">{title}</span>
            {view.type !== "list" && (
              <button
                onClick={() => setView({ type: "list" })}
                className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {view.type === "list" && (
              <div className="flex flex-col h-full">
                {/* Create bar */}
                <div className="px-4 py-3 border-b border-border shrink-0">
                  {showNewInput ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                        placeholder="Order set name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                          if (e.key === "Escape") setShowNewInput(false);
                        }}
                      />
                      <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || isCreating}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                      >
                        {isCreating ? "Creating…" : "Create"}
                      </button>
                      <button
                        onClick={() => setShowNewInput(false)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewInput(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={14} />
                      Create Order Set
                    </button>
                  )}
                </div>

                {/* Encounter notice */}
                {!inEncounter && (
                  <div className="mx-4 mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 shrink-0">
                    Open a patient encounter to use Apply &amp; Revert.
                  </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : orderSets.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No order sets yet. Create one above.
                    </p>
                  ) : (
                    orderSets.map((os) => (
                      <div
                        key={os.orderSetId}
                        className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{os.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {os.itemCount} item{os.itemCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <ActionBtn onClick={() => handleEdit(os)} title="Edit">
                            <ChevronRight size={14} />
                            <span className="text-xs">Edit</span>
                          </ActionBtn>
                          {inEncounter && (
                            <>
                              <ActionBtn
                                onClick={() => handleApply(os)}
                                disabled={applyingId === os.orderSetId}
                                title="Apply to current patient"
                                primary
                              >
                                {applyingId === os.orderSetId ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Plus size={12} />
                                )}
                                <span className="text-xs">Apply</span>
                              </ActionBtn>
                              <ActionBtn
                                onClick={() => handleShowRevert(os)}
                                title="Revert a previous application"
                                danger
                              >
                                <RotateCcw size={12} />
                                <span className="text-xs">Revert</span>
                              </ActionBtn>
                            </>
                          )}
                          <ActionBtn onClick={() => handleDelete(os)} title="Delete" danger>
                            <Trash2 size={13} />
                          </ActionBtn>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {view.type === "editor" && (
              <OrderSetEditor
                orderSetId={view.orderSet.orderSetId}
                orderSetName={view.orderSet.name}
                initialItems={view.items}
                onBack={() => {
                  setView({ type: "list" });
                  loadOrderSets();
                }}
              />
            )}

            {view.type === "revert" && (
              <div className="flex flex-col gap-4 p-4 overflow-y-auto max-h-full">
                <p className="text-xs text-muted-foreground">
                  Select an application to revert from this encounter.
                </p>
                {view.applications.map((app) => (
                  <div
                    key={app.applicationId}
                    className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">Applied</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(app.appliedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setRevertTarget(app);
                        setRevertPassword("");
                      }}
                      className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Revert
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revert password dialog */}
      {revertTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4">
            <p className="font-semibold">Confirm Revert</p>
            <p className="text-sm text-muted-foreground">
              All items applied from this order set will be removed. Manual entries are not affected.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Enter your password to confirm
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-sm"
                  placeholder="Password"
                  value={revertPassword}
                  onChange={(e) => setRevertPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRevert();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRevertTarget(null);
                  setRevertPassword("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevert}
                disabled={!revertPassword || isReverting}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 transition-colors"
              >
                {isReverting ? "Reverting…" : "Confirm Revert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  title,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  danger?: boolean;
}) {
  const base =
    "flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50";
  const color = primary
    ? "bg-primary/10 text-primary hover:bg-primary/20"
    : danger
    ? "text-destructive hover:bg-destructive/10"
    : "text-muted-foreground hover:bg-accent";
  return (
    <button className={`${base} ${color}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}
