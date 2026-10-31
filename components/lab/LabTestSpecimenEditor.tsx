"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Save, Trash2, Wand2 } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import SearchableSelect, { compactSelectClass } from "@/components/SearchableSelect";
import { ContainerSwatch } from "@/components/lab/SpecimenChips";
import { LabSpecimenService } from "@/services/labSpecimen.service";
import { apiErrorMessage } from "@/lib/apiError";
import { useRegion } from "@/lib/region";
import type { LabSpecimenType, LabTestSpecimenSetupType, SpecimenContainerType } from "@/types/labSpecimen.type";

interface Row {
  key: number;
  specimenContainerId: string;
  specimenType: string;
  volume: string;
  quantity: string;
  instructions: string;
}

let rowKey = 0;
const newRow = (r: Partial<Omit<Row, "key">> = {}): Row => ({
  key: ++rowKey,
  specimenContainerId: "",
  specimenType: "",
  volume: "",
  quantity: "1",
  instructions: "",
  ...r,
});

const rowsFromSetup = (s: LabTestSpecimenSetupType): Row[] =>
  s.specimens.map((r) =>
    newRow({
      specimenContainerId: r.specimenContainerId,
      specimenType: r.specimenType ?? "",
      volume: r.volume ?? "",
      quantity: String(r.quantity),
      instructions: r.instructions ?? "",
    })
  );

// "Specimen & containers" for one lab test: which container(s) its sample is collected in,
// with the test's own specimen type, volume and patient preparation. Starts on the region's
// default (HMC's in Qatar); once saved here the defaults never overwrite it.
export default function LabTestSpecimenEditor({ listItemId }: { listItemId: string }) {
  const region = useRegion();
  const country = region?.country ?? "region";
  const [setup, setSetup] = useState<LabTestSpecimenSetupType | null>(null);
  const [containers, setContainers] = useState<SpecimenContainerType[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applySetup = (s: LabTestSpecimenSetupType) => {
    setSetup(s);
    setRows(rowsFromSetup(s));
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([LabSpecimenService.getTestSetup(listItemId), LabSpecimenService.getContainers()])
      .then(([setupRes, containerRes]) => {
        if (cancelled) return;
        setContainers(containerRes.data ?? []);
        setSetup(setupRes.data);
        setRows(rowsFromSetup(setupRes.data));
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the test's containers")))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [listItemId]);

  const update = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const containerById = new Map(containers.map((c) => [c.specimenContainerId, c]));
  const containerByCode = new Map(containers.map((c) => [c.code.toUpperCase(), c]));

  const fillDefaults = () => {
    if (!setup) return;
    setRows(
      setup.defaults
        .map((d: LabSpecimenType) => {
          const c = d.containerCode ? containerByCode.get(d.containerCode.toUpperCase()) : undefined;
          return c
            ? newRow({
                specimenContainerId: c.specimenContainerId,
                specimenType: d.specimenType && d.specimenType !== c.specimenType ? d.specimenType : "",
                volume: d.volume && d.volume !== c.defaultVolume ? d.volume : "",
                quantity: String(d.quantity),
                instructions: d.instructions ?? "",
              })
            : null;
        })
        .filter((r): r is Row => r != null)
    );
    setDirty(true);
  };

  const save = async () => {
    if (rows.some((r) => !r.specimenContainerId)) return toast.error("Choose a container for every row");
    if (rows.some((r) => !/^\d+$/.test(r.quantity) || Number(r.quantity) < 1 || Number(r.quantity) > 10))
      return toast.error("Number of containers must be 1 to 10");
    try {
      setSaving(true);
      const res = await LabSpecimenService.saveTestSpecimens(
        listItemId,
        rows.map((r) => ({
          specimenContainerId: r.specimenContainerId,
          specimenType: r.specimenType.trim() || null,
          volume: r.volume.trim() || null,
          quantity: Number(r.quantity),
          instructions: r.instructions.trim() || null,
        }))
      );
      toast.success(res.message || "Saved");
      applySetup(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the containers"));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      setSaving(true);
      const res = await LabSpecimenService.resetTestSpecimens(listItemId);
      toast.success(res.message || "Back on the defaults");
      applySetup(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't reset the containers"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="py-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  if (!setup) return null;

  const status = setup.specimens.length === 0
    ? setup.defaultNoContainer
      ? `The ${country} rules say this test needs no container (${setup.defaultRule}).`
      : "Not set - the region's rules don't recognize this test. Add its container below."
    : setup.isAutoAssigned
      ? `Using the ${country} default${setup.defaultRule ? ` - ${setup.defaultRule}` : ""}.`
      : "Set by your lab - the region's defaults leave it alone.";

  const options = [
    { value: "", label: "Choose container…" },
    ...containers.map((c) => ({ value: c.specimenContainerId, label: c.name })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Specimen &amp; containers</p>
        <button
          onClick={() => {
            setRows((prev) => [...prev, newRow()]);
            setDirty(true);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus size={13} /> Add container
        </button>
      </div>
      <p className={`text-xs ${setup.specimens.length === 0 && !setup.defaultNoContainer ? "text-amber-600" : "text-muted-foreground"}`}>{status}</p>

      {rows.map((r) => {
        const c = containerById.get(r.specimenContainerId);
        return (
          <div key={r.key} className="rounded-lg border border-border p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ContainerSwatch hex={c?.colorHex} size={14} />
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={r.specimenContainerId}
                  onChange={(v) => update(r.key, { specimenContainerId: v })}
                  className={compactSelectClass}
                  preserveCase
                  options={options}
                />
              </div>
              <input
                type="number"
                min={1}
                max={10}
                value={r.quantity}
                onChange={(e) => update(r.key, { quantity: e.target.value })}
                title="How many of this container the test needs"
                className="h-8 w-14 text-xs"
              />
              <button
                onClick={() => {
                  setRows((prev) => prev.filter((x) => x.key !== r.key));
                  setDirty(true);
                }}
                title="Remove"
                className="rounded-full p-1.5 text-red-500 hover:bg-red-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={r.specimenType}
                onChange={(e) => update(r.key, { specimenType: e.target.value })}
                maxLength={100}
                placeholder={c?.specimenType ? `Specimen (${c.specimenType})` : "Specimen type"}
                className="h-8 text-xs"
              />
              <input
                type="text"
                value={r.volume}
                onChange={(e) => update(r.key, { volume: e.target.value })}
                maxLength={60}
                placeholder={c?.defaultVolume ? `Volume (${c.defaultVolume})` : "Volume"}
                className="h-8 text-xs"
              />
              <input
                type="text"
                value={r.instructions}
                onChange={(e) => update(r.key, { instructions: e.target.value })}
                maxLength={1000}
                placeholder="Patient preparation / collection instructions (e.g. fasting 8-10 hours)"
                className="h-8 text-xs col-span-2"
              />
            </div>
            {c?.handlingNotes && <p className="text-[11px] text-muted-foreground">{c.handlingNotes}</p>}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {setup.defaults.length > 0 && (
          <button
            onClick={fillDefaults}
            className="mr-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            title={setup.defaults.map((d) => d.containerName).join(" + ")}
          >
            <Wand2 size={13} /> Fill in the {country} default
          </button>
        )}
        {setup.specimens.length > 0 && !setup.isAutoAssigned && (
          <button
            onClick={() => void reset()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw size={13} /> Back to {country} default
          </button>
        )}
        <button
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Save size={13} /> {saving ? "Saving…" : "Save containers"}
        </button>
      </div>
    </div>
  );
}
