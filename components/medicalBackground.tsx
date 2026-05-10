import { GiMedicalPack } from "react-icons/gi";

export default function MedicalBackground() {
  return (
    <>
      <div className="card rounded-xl shadow-2xl border-t p-8 mt-8">
        <span className="flex items-center gap-4 text-2xl font-semibold mb-6">
          <GiMedicalPack className="text-blue-500" />
          <h2>Medical Background</h2>
        </span>
        <hr className="text-neutral-400/50 mb-6" />

        <div className="mt-6">
          <label htmlFor="medical-history" className="font-bold">
            Medical history
          </label>
          <textarea
            id="medical-history"
            name="medical-history"
            placeholder="List any past surgeries, chronic conditions, or significant medical events ..."
            className="outline-0 p-4 rounded-xl w-full mt-2 h-26 resize-none"
            style={{
              backgroundColor: "var(--color-highlight)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div className="mt-6">
          <label htmlFor="known-allergies" className="font-bold">
            Known Allergies
          </label>
          <textarea
            id="known-allergies"
            name="known-allergies"
            placeholder="List any food, medication, or environmental allergies ..."
            className="outline-0 p-4 rounded-xl w-full mt-2 h-26 resize-none"
            style={{
              backgroundColor: "var(--color-highlight)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>
      </div>
    </>
  );
}
