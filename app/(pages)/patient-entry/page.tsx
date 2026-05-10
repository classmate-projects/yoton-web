import { MdOutlinePersonOutline } from "react-icons/md";


export default function PatientEntryPage() {
  return (
    <div className="flex flex-col h-dvh py-8 px-10 gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-semibold">New Patient Entry</h1>
        <p className="text-sm text-gray-500">
          Please fill in the patient details accurately to ensure correct record keeping.
        </p>
      </div>

      <div className="card rounded-xl shadow-2xl border-t p-8 mt-8 ">
        <span className="flex items-center gap-2 text-2xl font-semibold mb-6">
          <MdOutlinePersonOutline className="text-blue-500" size={30} />
          <h2>Personal Information</h2>
        </span>
        <hr className="text-neutral-400/50 mb-6" />
        <form className="flex flex-col gap-6">
          <div>
            <label htmlFor="fullname" className="font-bold">Full Name</label>
            <input
              type="text"
              id="fullname"
              name="fullname"
              placeholder="Johnathan Doe"
              className="outline-0 p-4 rounded-xl w-full mt-2"
              style={{
                backgroundColor: "var(--color-highlight)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              required
            />
          </div>

          <div className="flex items-center gap-4 justify-center w-full">
            <div className="w-full">
              <label htmlFor="age" className="font-bold">Age</label>
              <input
                type="number"
                id="age"
                name="age"
                placeholder="30"
                max={200}
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                required
              />
            </div>
            <div className="w-full">
              <label htmlFor="gender" className="font-bold">Gender</label>
              <select
                name="gender"
                id="gender"
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                required
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center w-full">
            <div className="w-full">
              <label htmlFor="phone" className="font-bold">Phone Number</label>
              <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="+1 234 567 890"
              className="outline-0 p-4 rounded-xl w-full mt-2"
              style={{
                backgroundColor: "var(--color-highlight)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              required
            />
            </div>

            <div className="w-full">
                <label htmlFor="assign-doctor" className="font-bold"  >Assign Doctor</label>
                <select
                  name="assign-doctor"
                  id="assign-doctor"
                  className="outline-0 p-4 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <option value="">Select a Doctor</option>
                  <option value="dr-smith">Dr. Smith</option>
                  <option value="dr-johnson">Dr. Johnson</option>
                  <option value="dr-williams">Dr. Williams</option>
                </select>
              </div>
          </div>
        </form>
      </div>
      <div className="flex justify-end gap-8 mt-8">
        <button className="px-6 py-3 rounded-xl border border-[#00288E] hover:bg-red-500/50 transition-all duration-200 cursor-pointer text-lg">Cancel</button>
        <button className="px-6 py-3 rounded-xl border border-transparent hover:border-[#00288E] bg-[#00288E] hover:bg-blue-800 transition-all duration-200 cursor-pointer text-lg text-white">Register</button>
      </div>
    </div>
  );
}
