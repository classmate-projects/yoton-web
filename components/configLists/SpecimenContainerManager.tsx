"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import EditIcon from "@/public/icons/EditIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import { ContainerSwatch } from "@/components/lab/SpecimenChips";
import { LabSpecimenService } from "@/services/labSpecimen.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { apiErrorMessage } from "@/lib/apiError";
import {
  SPECIMEN_CONTAINER_CATEGORIES,
  type LabSpecimenCoverageType,
  type SaveSpecimenContainerPayload,
  type SpecimenContainerCategory,
  type SpecimenContainerType,
} from "@/types/labSpecimen.type";

type Filter = "All" | SpecimenContainerCategory | "Inactive";

interface EditorState extends Omit<SaveSpecimenContainerPayload, "drawOrder"> {
  specimenContainerId: string | null;
  isSystemDefault: boolean;
  drawOrder: string;
}

const toPayload = (c: SpecimenContainerType, isActive = c.isActive): SaveSpecimenContainerPayload => ({
  code: c.code,
  name: c.name,
  capColor: c.capColor,
  colorHex: c.colorHex,
  additive: c.additive,
  specimenType: c.specimenType,
  category: c.category,
  defaultVolume: c.defaultVolume,
  inversions: c.inversions,
  drawOrder: c.drawOrder,
  handlingNotes: c.handlingNotes,
  isActive,
  sortOrder: c.sortOrder,
});

const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);

// Admin's specimen container master: every tube, bottle, swab and pot a lab sample is
// collected in, seeded from the installation's region (Qatar: HMC's collection manual) with
// its cap colour, additive, order of draw and handling. Also shows how many of the lab tests
// in the catalog have their containers set, and fills in the region's defaults for the rest.
export default function SpecimenContainerManager() {
  const [containers, setContainers] = useState<SpecimenContainerType[]>([]);
  const [coverage, setCoverage] = useState<LabSpecimenCoverageType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = async () => {
    try {
      const [listRes, coverageRes] = await Promise.all([LabSpecimenService.getContainers(true), LabSpecimenService.getCoverage()]);
      setContainers(listRes.data ?? []);
      setCoverage(coverageRes.data ?? null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load specimen containers"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useSignalRRefetch(["labSpecimensUpdated", "listItemAdded", "listItemUpdated", "listItemDeleted"], () => void load());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return containers.filter((c) => {
      if (filter === "Inactive" ? c.isActive : filter !== "All" && c.category !== filter) return false;
      if (!term) return true;
      return [c.name, c.code, c.additive, c.capColor, c.specimenType].some((s) => s?.toLowerCase().includes(term));
    });
  }, [containers, search, filter]);

  const openNew = () =>
    setEditor({
      specimenContainerId: null,
      isSystemDefault: false,
      code: "",
      name: "",
      capColor: "",
      colorHex: "#9E9E9E",
      additive: "",
      specimenType: "",
      category: "Blood tube",
      defaultVolume: "",
      inversions: "",
      drawOrder: "",
      handlingNotes: "",
      isActive: true,
      sortOrder: containers.length,
    });

  const openEdit = (c: SpecimenContainerType) =>
    setEditor({
      ...toPayload(c),
      specimenContainerId: c.specimenContainerId,
      isSystemDefault: c.isSystemDefault,
      capColor: c.capColor ?? "",
      colorHex: c.colorHex ?? "",
      additive: c.additive ?? "",
      specimenType: c.specimenType ?? "",
      defaultVolume: c.defaultVolume ?? "",
      inversions: c.inversions ?? "",
      handlingNotes: c.handlingNotes ?? "",
      drawOrder: c.drawOrder != null ? String(c.drawOrder) : "",
    });

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) return toast.error("Container name is required");
    if (!editor.code.trim()) return toast.error("Container code is required");
    if (editor.drawOrder.trim() && !/^\d{1,2}$/.test(editor.drawOrder.trim()))
      return toast.error("Order of draw is a whole number (1 = drawn first) - or leave it blank");

    const payload: SaveSpecimenContainerPayload = {
      code: editor.code.trim(),
      name: editor.name.trim(),
      capColor: blank(editor.capColor),
      colorHex: blank(editor.colorHex),
      additive: blank(editor.additive),
      specimenType: blank(editor.specimenType),
      category: editor.category,
      defaultVolume: blank(editor.defaultVolume),
      inversions: blank(editor.inversions),
      drawOrder: editor.drawOrder.trim() ? Number(editor.drawOrder) : null,
      handlingNotes: blank(editor.handlingNotes),
      isActive: editor.isActive,
      sortOrder: editor.sortOrder,
    };
    try {
      setSaving(true);
      const res = editor.specimenContainerId
        ? await LabSpecimenService.updateContainer(editor.specimenContainerId, payload)
        : await LabSpecimenService.createContainer(payload);
      toast.success(res.message || "Saved");
      setEditor(null);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the container"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: SpecimenContainerType) => {
    try {
      await LabSpecimenService.updateContainer(c.specimenContainerId, toPayload(c, !c.isActive));
      toast.success(`${c.name} ${c.isActive ? "switched off" : "switched on"}`);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update the container"));
    }
  };

  const remove = (c: SpecimenContainerType) =>
    confirmDeleteToast(
      <span>
        Delete <b className="text-red-500 ml-1">{c.name}</b>?
      </span>,
      async () => {
        try {
          await LabSpecimenService.deleteContainer(c.specimenContainerId);
          toast.success(`${c.name} deleted`);
          void load();
        } catch (err) {
          toast.error(apiErrorMessage(err, "Couldn't delete the container"));
        }
      }
    );

  const applyDefaults = async () => {
    try {
      setApplying(true);
      const res = await LabSpecimenService.applyDefaults();
      toast.success(res.message || "Defaults applied");
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't apply the defaults"));
    } finally {
      setApplying(false);
    }
  };

  const set = coverage ? coverage.setByAdmin + coverage.regionDefault : 0;

  return (
    <div className="flex flex-col gap-4">
      {coverage && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FlaskConical size={16} className="text-primary" />
              {set} of {coverage.labTests} lab tests have their containers set
            </p>
            <p className="text-xs text-muted-foreground">
              {coverage.regionDefault} from the {coverage.country} defaults · {coverage.setByAdmin} set by your lab ·{" "}
              {coverage.noContainerNeeded} need no container · {coverage.notSet} not recognized - set these by hand on the
              lab test (flask icon on the Procedure list)
            </p>
            <p className="text-[11px] text-muted-foreground">Defaults follow {coverage.source}.</p>
          </div>
          <button
            onClick={() => void applyDefaults()}
            disabled={applying}
            title="Gives every lab test the default containers, except the ones your lab has set by hand"
            className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Wand2 size={15} /> {applying ? "Applying…" : `Apply ${coverage.country} defaults`}
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...SPECIMEN_CONTAINER_CATEGORIES, "Inactive"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <SearchIcon color="#555" />
              </span>
              <input
                type="text"
                placeholder="Search containers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus size={15} /> Add container
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="text-center" title="Venipuncture order of draw - lowest is drawn first">Draw</th>
                <th>Container</th>
                <th>Additive · specimen</th>
                <th>Volume · mixing</th>
                <th>Handling</th>
                <th className="text-center">Tests</th>
                <th className="text-center">Active</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState illustration={search ? "search" : "clipboard"} title={search ? "No matches" : "No containers here"} />
                  </td>
                </tr>
              ) : (
                visible.map((c) => (
                  <tr key={c.specimenContainerId} className={c.isActive ? "" : "opacity-60"}>
                    <td className="text-center font-semibold text-muted-foreground">{c.drawOrder ?? "—"}</td>
                    <td>
                      <div className="flex items-start gap-2">
                        <ContainerSwatch hex={c.colorHex} size={16} title={c.capColor ?? undefined} />
                        <div>
                          <p className="font-semibold">
                            {c.name}
                            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{c.code}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.category}
                            {c.capColor ? ` · ${c.capColor} cap` : ""}
                            {!c.isSystemDefault && " · added by your organization"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-foreground/80">{[c.additive, c.specimenType].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-xs text-foreground/80">
                      {[c.defaultVolume, c.inversions && (/^\d/.test(c.inversions) ? `invert ${c.inversions}×` : c.inversions)].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="text-xs text-muted-foreground max-w-xs">
                      <p className="line-clamp-2" title={c.handlingNotes ?? undefined}>
                        {c.handlingNotes || "—"}
                      </p>
                    </td>
                    <td className="text-center text-sm">{c.testCount}</td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <ToggleButton checked={c.isActive} onChange={() => void toggleActive(c)} />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center items-center">
                        {!c.isSystemDefault && c.testCount === 0 && (
                          <button
                            onClick={() => remove(c)}
                            title="Delete"
                            className="hover:bg-red-100 transition-colors duration-150 rounded-full p-2 cursor-pointer mr-2"
                          >
                            <Trash2 size={18} className="text-red-500" />
                          </button>
                        )}
                        <button
                          title="Edit"
                          onClick={() => openEdit(c)}
                          className="hover:bg-blue-100 transition-colors duration-150 rounded-full p-2 cursor-pointer"
                        >
                          <EditIcon color="blue" size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-background p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <ContainerSwatch hex={editor.colorHex} size={16} />
                {editor.specimenContainerId ? `Edit ${editor.name || "container"}` : "Add container"}
              </h2>
              <button onClick={() => setEditor(null)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground required">Name</label>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  maxLength={150}
                  placeholder="e.g. Lavender top - K2EDTA"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground required">Code</label>
                <input
                  type="text"
                  value={editor.code}
                  onChange={(e) => setEditor({ ...editor, code: e.target.value })}
                  maxLength={30}
                  disabled={editor.isSystemDefault}
                  title={editor.isSystemDefault ? "A standard container's code is how the region's defaults find it" : undefined}
                  placeholder="e.g. EDTA"
                  className="h-10 w-full text-sm disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground required">Category</label>
                <SearchableSelect
                  value={editor.category}
                  onChange={(v) => setEditor({ ...editor, category: v as SpecimenContainerCategory })}
                  className={fieldSelectClass}
                  preserveCase
                  options={SPECIMEN_CONTAINER_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Cap colour</label>
                <input
                  type="text"
                  value={editor.capColor ?? ""}
                  onChange={(e) => setEditor({ ...editor, capColor: e.target.value })}
                  maxLength={50}
                  placeholder="e.g. Lavender"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Swatch</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(editor.colorHex ?? "") ? editor.colorHex! : "#ffffff"}
                    onChange={(e) => setEditor({ ...editor, colorHex: e.target.value })}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded border border-border p-0.5"
                  />
                  <input
                    type="text"
                    value={editor.colorHex ?? ""}
                    onChange={(e) => setEditor({ ...editor, colorHex: e.target.value })}
                    maxLength={7}
                    placeholder="#9C6ADE"
                    className="h-10 w-full text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Additive</label>
                <input
                  type="text"
                  value={editor.additive ?? ""}
                  onChange={(e) => setEditor({ ...editor, additive: e.target.value })}
                  maxLength={150}
                  placeholder="e.g. 3.2% sodium citrate (9:1)"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Specimen</label>
                <input
                  type="text"
                  value={editor.specimenType ?? ""}
                  onChange={(e) => setEditor({ ...editor, specimenType: e.target.value })}
                  maxLength={100}
                  placeholder="e.g. Whole blood"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Usual volume</label>
                <input
                  type="text"
                  value={editor.defaultVolume ?? ""}
                  onChange={(e) => setEditor({ ...editor, defaultVolume: e.target.value })}
                  maxLength={60}
                  placeholder="e.g. 3 mL"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Inversions</label>
                <input
                  type="text"
                  value={editor.inversions ?? ""}
                  onChange={(e) => setEditor({ ...editor, inversions: e.target.value })}
                  maxLength={30}
                  placeholder="e.g. 8-10"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Order of draw</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editor.drawOrder}
                  onChange={(e) => setEditor({ ...editor, drawOrder: e.target.value })}
                  placeholder="Blank if not drawn"
                  title="1 = blood culture, drawn first. Leave blank for urine, swabs and other non-blood containers."
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground">Collection & handling notes</label>
                <textarea
                  value={editor.handlingNotes ?? ""}
                  onChange={(e) => setEditor({ ...editor, handlingNotes: e.target.value })}
                  maxLength={1000}
                  placeholder="What the collector must do - fill line, time to the lab, temperature..."
                  className="w-full min-h-20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-3">
                <ToggleButton checked={editor.isActive} onChange={(checked) => setEditor({ ...editor, isActive: checked })} />
                <span className="text-sm text-foreground">
                  {editor.isActive ? "Active - can be assigned to lab tests" : "Switched off - not offered for lab tests"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setEditor(null)} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save size={15} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
