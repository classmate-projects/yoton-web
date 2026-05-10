import { MdOutlinePersonOutline } from "react-icons/md";

export default function PatientEntryPage() {
  return (
    <>
      <form className="flex flex-col py-8 px-10 gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold">New Patient Entry</h1>
          <p className="text-sm text-gray-500">
            Please fill in the patient details accurately to ensure correct
            record keeping.
          </p>
        </div>

        <div className="card rounded-xl shadow-2xl border-t p-8 mt-8 ">
          <span className="flex items-center gap-2 text-2xl font-semibold mb-6">
            <MdOutlinePersonOutline className="text-blue-500" size={30} />
            <h2>Personal Information</h2>
          </span>
          <hr className="text-neutral-400/50 mb-6" />
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 justify-center w-full">
              <div className="w-full">
                <label htmlFor="fullname" className="font-bold required">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullname"
                  name="fullname"
                  required
                  placeholder="Johnathan Doe"
                  className="outline-0 p-4 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

              <div className="flex items-center gap-4 justify-center w-full">
                <div className="w-full">
                  <label htmlFor="age" className="font-bold required">
                    Age
                  </label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    required
                    placeholder="30"
                    max={200}
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
                <div className="w-full">
                  <label htmlFor="gender" className="font-bold required">
                    Gender
                  </label>
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
            </div>

            <div className="flex items-center gap-4 justify-center w-full">
              <div className="w-full">
                <label htmlFor="phone" className="font-bold required">
                  Phone Number
                </label>
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
                <label htmlFor="email" className="font-bold">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="john.doe@example.com"
                  className="outline-0 p-4 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

              <div className="w-full">
                <label htmlFor="assign-doctor" className="font-bold">
                  Assign Doctor
                </label>
                <select
                  name="assign-doctor"
                  id="assign-doctor"
                  required
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
          </div>
        </div>
        <div className="flex justify-end gap-8 mt-6">
          <button className="px-6 py-3 rounded-md border border-neutral-400/50 hover:bg-neutral-300/50 transition-all duration-200 cursor-pointer text-lg">
            Cancel
          </button>
          <button className="px-6 py-3 rounded-md border border-transparent  bg-blue-500 hover:bg-blue-600 transition-all duration-200 cursor-pointer text-lg text-white">
            Save Patient
          </button>
        </div>
      </form>
    </>
  );
}
