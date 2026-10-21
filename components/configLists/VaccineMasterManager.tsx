"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Syringe, Trash2, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import SearchableSelect, { compactSelectClass, fieldSelectClass } from "@/components/SearchableSelect";
import EditIcon from "@/public/icons/EditIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import { ImmunizationService } from "@/services/immunization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { apiErrorMessage } from "@/lib/apiError";
import type { SaveVaccinePayload, VaccineAgeUnit, VaccineCategory, VaccineType } from "@/types/immunization.type";
import { INJECTION_SITES, VACCINE_ROUTES, withCurrentOption } from "@/components/immunization/immunizationUi";

const CATEGORIES: VaccineCategory[] = ["Routine", "Optional", "Travel", "COVID-19", "Organization-specific"];
const AGE_UNITS: VaccineAgeUnit[] = ["Days", "Weeks", "Months", "Years"];

type Filter = "All" | VaccineCategory | "Inactive";

interface DoseRow {
  key: number;
  label: string;
  ageValue: string;
  ageUnit: VaccineAgeUnit;
  // Optional end of an age window ("4-6 years"); blank for a dose given at one age.
  untilValue: string;
  untilUnit: VaccineAgeUnit;
}

interface EditorState {
  vaccineId: string | null;
  name: string;
  code: string;
  description: string;
  category: VaccineCategory;
  defaultRoute: string;
  defaultSite: string;
  defaultDose: string;
  isActive: boolean;
  doses: DoseRow[];
}

const toPayload = (v: VaccineType, isActive = v.isActive): SaveVaccinePayload => ({
  name: v.name,
  code: v.code,
  description: v.description,
  category: v.category,
  defaultRoute: v.defaultRoute,
  defaultSite: v.defaultSite,
  defaultDose: v.defaultDose,
  isActive,
  sortOrder: v.sortOrder,
  doses: v.doses.map((d) => ({
    doseNumber: d.doseNumber,
    label: d.label,
    ageValue: d.ageValue,
    ageUnit: d.ageUnit,
    dueUntilValue: d.dueUntilValue,
    dueUntilUnit: d.dueUntilUnit,
  })),
});

let rowKey = 0;
const newRow = (
  ageValue = "",
  ageUnit: VaccineAgeUnit = "Months",
  label = "",
  untilValue = "",
  untilUnit: VaccineAgeUnit = ageUnit
): DoseRow => ({ key: ++rowKey, label, ageValue, ageUnit, untilValue, untilUnit });

// Admin's vaccine master for the Pediatric Immunization Schedule: the standard vaccines
// (seeded) plus organization-specific ones. A Routine vaccine's doses are what every
// pediatric patient's schedule recommends; other categories are ordered on demand.
export default function VaccineMasterManager() {
  const [vaccines, setVaccines] = useState<VaccineType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await ImmunizationService.getVaccines(true);
      setVaccines(res.data ?? []);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load vaccines"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useSignalRRefetch(["vaccineMasterUpdated"], () => void load());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vaccines.filter((v) => {
      if (filter === "Inactive" ? v.isActive : filter !== "All" && v.category !== filter) return false;
      if (!term) return true;
      return [v.name, v.code, v.description].some((s) => s?.toLowerCase().includes(term));
    });
  }, [vaccines, search, filter]);

  const openNew = () =>
    setEditor({
      vaccineId: null,
      name: "",
      code: "",
      description: "",
      category: "Organization-specific",
      defaultRoute: "",
      defaultSite: "",
      defaultDose: "",
      isActive: true,
      doses: [],
    });

  const openEdit = (v: VaccineType) =>
    setEditor({
      vaccineId: v.vaccineId,
      name: v.name,
      code: v.code ?? "",
      description: v.description ?? "",
      category: v.category,
      defaultRoute: v.defaultRoute ?? "",
      defaultSite: v.defaultSite ?? "",
      defaultDose: v.defaultDose ?? "",
      isActive: v.isActive,
      doses: v.doses.map((d) =>
        newRow(String(d.ageValue), d.ageUnit, d.label ?? "", d.dueUntilValue != null ? String(d.dueUntilValue) : "", d.dueUntilUnit ?? d.ageUnit)
      ),
    });

  const setCategory = (category: VaccineCategory) =>
    setEditor((e) => (e ? { ...e, category, doses: category === "Routine" && e.doses.length === 0 ? [newRow("0", "Days")] : e.doses } : e));

  const updateDose = (key: number, patch: Partial<DoseRow>) =>
    setEditor((e) => (e ? { ...e, doses: e.doses.map((d) => (d.key === key ? { ...d, ...patch } : d)) } : e));

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) return toast.error("Vaccine name is required");
    const isRoutine = editor.category === "Routine";
    if (isRoutine && editor.doses.length === 0) return toast.error("A routine vaccine needs at least one scheduled dose");
    if (isRoutine && editor.doses.some((d) => d.ageValue.trim() === "" || !Number.isInteger(Number(d.ageValue)) || Number(d.ageValue) < 0))
      return toast.error("Enter each dose's recommended age as a whole number (0 = at birth)");
    if (isRoutine && editor.doses.some((d) => d.untilValue.trim() !== "" && (!Number.isInteger(Number(d.untilValue)) || Number(d.untilValue) <= 0)))
      return toast.error("An \"until\" age must be a whole number - or leave it blank");

    const payload: SaveVaccinePayload = {
      name: editor.name.trim(),
      code: editor.code.trim() || null,
      description: editor.description.trim() || null,
      category: editor.category,
      defaultRoute: editor.defaultRoute || null,
      defaultSite: editor.defaultSite || null,
      defaultDose: editor.defaultDose.trim() || null,
      isActive: editor.isActive,
      // Dose numbers follow the row order, so removing a row never leaves a gap.
      doses: isRoutine
        ? editor.doses.map((d, i) => ({
            doseNumber: i + 1,
            label: d.label.trim() || null,
            ageValue: Number(d.ageValue),
            ageUnit: d.ageUnit,
            dueUntilValue: d.untilValue.trim() ? Number(d.untilValue) : null,
            dueUntilUnit: d.untilValue.trim() ? d.untilUnit : null,
          }))
        : [],
    };

    try {
      setSaving(true);
      const res = editor.vaccineId
        ? await ImmunizationService.updateVaccine(editor.vaccineId, payload)
        : await ImmunizationService.createVaccine(payload);
      toast.success(res.message || "Saved");
      setEditor(null);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the vaccine"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: VaccineType) => {
    try {
      await ImmunizationService.updateVaccine(v.vaccineId, toPayload(v, !v.isActive));
      toast.success(`${v.name} ${v.isActive ? "deactivated" : "activated"}`);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update the vaccine"));
    }
  };

  const remove = (v: VaccineType) =>
    confirmDeleteToast(
      <span>
        Delete <b className="text-red-500 ml-1">{v.name}</b> from the vaccine master?
      </span>,
      async () => {
        try {
          await ImmunizationService.deleteVaccine(v.vaccineId);
          toast.success(`${v.name} deleted`);
          void load();
        } catch (err) {
          toast.error(apiErrorMessage(err, "Couldn't delete the vaccine"));
        }
      }
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...CATEGORIES, "Inactive"] as Filter[]).map((f) => (
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
                placeholder="Search vaccines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus size={15} /> Add vaccine
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Vaccine</th>
                <th>Category</th>
                <th>Routine schedule</th>
                <th>Default route · site · dose</th>
                <th className="text-center">Active</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState illustration={search ? "search" : "clipboard"} title={search ? "No matches" : "No vaccines here yet"} />
                  </td>
                </tr>
              ) : (
                visible.map((v) => (
                  <tr key={v.vaccineId} className={v.isActive ? "" : "opacity-60"}>
                    <td>
                      <p className="font-semibold">
                        {v.name}
                        {v.code && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{v.code}</span>}
                      </p>
                      {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          v.category === "Routine"
                            ? "bg-blue-100 text-blue-700"
                            : v.category === "Organization-specific"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v.category}
                      </span>
                      {!v.isSystemDefault && <p className="mt-0.5 text-[11px] text-muted-foreground">Added by your organization</p>}
                    </td>
                    <td className="text-xs">
                      {v.doses.length > 0 ? v.doses.map((d) => `${d.doseLabel}: ${d.ageLabel}`).join(" · ") : <span className="text-muted-foreground">Ordered on demand</span>}
                    </td>
                    <td className="text-xs text-foreground/80">
                      {[v.defaultRoute, v.defaultSite, v.defaultDose].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <ToggleButton checked={v.isActive} onChange={() => void toggleActive(v)} />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center items-center">
                        {!v.isSystemDefault && v.orderCount === 0 && (
                          <button
                            onClick={() => remove(v)}
                            title="Delete"
                            className="hover:bg-red-100 transition-colors duration-150 rounded-full p-2 cursor-pointer mr-2"
                          >
                            <Trash2 size={18} className="text-red-500" />
                          </button>
                        )}
                        <button
                          title="Edit"
                          onClick={() => openEdit(v)}
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
                <Syringe size={18} className="text-primary" /> {editor.vaccineId ? `Edit ${editor.name || "vaccine"}` : "Add vaccine"}
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
                  maxLength={100}
                  placeholder="e.g. Hexa"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Code</label>
                <input
                  type="text"
                  value={editor.code}
                  onChange={(e) => setEditor({ ...editor, code: e.target.value })}
                  maxLength={30}
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  maxLength={300}
                  placeholder="What it protects against, e.g. DTaP-IPV-Hib-HepB (hexavalent)"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground required">Category</label>
                <SearchableSelect
                  value={editor.category}
                  onChange={(v) => setCategory(v as VaccineCategory)}
                  className={fieldSelectClass}
                  preserveCase
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Default route</label>
                <SearchableSelect
                  value={editor.defaultRoute}
                  onChange={(v) => setEditor({ ...editor, defaultRoute: v })}
                  className={fieldSelectClass}
                  preserveCase
                  options={[{ value: "", label: "None" }, ...withCurrentOption(VACCINE_ROUTES, editor.defaultRoute)]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Default site</label>
                <SearchableSelect
                  value={editor.defaultSite}
                  onChange={(v) => setEditor({ ...editor, defaultSite: v })}
                  className={fieldSelectClass}
                  preserveCase
                  options={[{ value: "", label: "None" }, ...withCurrentOption(INJECTION_SITES, editor.defaultSite)]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Usual dose</label>
                <input
                  type="text"
                  value={editor.defaultDose}
                  onChange={(e) => setEditor({ ...editor, defaultDose: e.target.value })}
                  maxLength={50}
                  placeholder="e.g. 0.5 mL"
                  className="h-10 w-full text-sm"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 pt-5">
                <ToggleButton checked={editor.isActive} onChange={(checked) => setEditor({ ...editor, isActive: checked })} />
                <span className="text-sm text-foreground">{editor.isActive ? "Active - can be scheduled" : "Inactive - hidden from new orders"}</span>
              </div>
            </div>

            {editor.category === "Routine" ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Routine schedule</p>
                  <button
                    onClick={() => setEditor({ ...editor, doses: [...editor.doses, newRow()] })}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus size={13} /> Add dose
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every pediatric patient&apos;s schedule recommends these doses at the age given (0 days = at birth).
                  Fill in &quot;until&quot; for a dose given across an age range (e.g. 4 until 6 years) - it stays due,
                  not overdue, until then.
                </p>
                <div className="grid grid-cols-[56px_1fr_64px_96px_64px_96px_32px] items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span />
                  <span>Label</span>
                  <span>At age</span>
                  <span />
                  <span>Until</span>
                  <span />
                  <span />
                </div>
                {editor.doses.map((d, i) => (
                  <div key={d.key} className="grid grid-cols-[56px_1fr_64px_96px_64px_96px_32px] items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Dose {i + 1}</span>
                    <input
                      type="text"
                      value={d.label}
                      onChange={(e) => updateDose(d.key, { label: e.target.value })}
                      maxLength={50}
                      placeholder={`Dose ${i + 1}`}
                      className="h-8 w-full text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={d.ageValue}
                      onChange={(e) => updateDose(d.key, { ageValue: e.target.value })}
                      placeholder="Age"
                      className="h-8 w-full text-xs"
                    />
                    <SearchableSelect
                      value={d.ageUnit}
                      onChange={(v) => updateDose(d.key, { ageUnit: v as VaccineAgeUnit })}
                      className={compactSelectClass}
                      preserveCase
                      options={AGE_UNITS.map((u) => ({ value: u, label: u }))}
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={d.untilValue}
                      onChange={(e) => updateDose(d.key, { untilValue: e.target.value })}
                      placeholder="—"
                      title="Optional - end of the age range this dose is given in"
                      className="h-8 w-full text-xs"
                    />
                    <SearchableSelect
                      value={d.untilUnit}
                      onChange={(v) => updateDose(d.key, { untilUnit: v as VaccineAgeUnit })}
                      className={compactSelectClass}
                      preserveCase
                      disabled={!d.untilValue.trim()}
                      options={AGE_UNITS.map((u) => ({ value: u, label: u }))}
                    />
                    <button
                      onClick={() => setEditor({ ...editor, doses: editor.doses.filter((x) => x.key !== d.key) })}
                      title="Remove dose"
                      className="rounded-full p-1.5 text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Only Routine vaccines carry a recommended schedule - this one is ordered on demand with a dose number.
              </p>
            )}

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
