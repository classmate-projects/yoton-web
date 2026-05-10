export default function UserRegistrationPage() {
  return (
    <div className=" h-dvh flex flex-col py-8 px-10 gap-4">
      <div>
        <h1 className="text-4xl font-semibold">Staff Registration</h1>
        <p className="text-sm text-gray-500">
          Enter new personnel details to provision system access.
        </p>
      </div>

      <div>
        <form className="card rounded-xl shadow-2xl border-t p-8 mt-8 flex flex-col gap-6">
          <div>
            <label htmlFor="fullname" className="font-bold required">
              Full name
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

          <div className="flex items-center gap-4">
            <div className="w-full">
              <label htmlFor="role" className="font-bold required">
                Role
              </label>
              <select
                name="role"
                id="role"
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                required
              >
                <option value="">Select Role</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="receptionist">Receptionist</option>
              </select>
            </div>

            <div className="w-full">
              <label htmlFor="email" className="font-bold required">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="johnathan.doe@example.com"
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-full">
              <label htmlFor="phone" className="phone">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                placeholder="+1 (555) 123-4567"
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div className="w-full">
              <label htmlFor="password" className="font-bold required">
                Temporary Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                placeholder="Enter temporary password"
                className="outline-0 p-4 rounded-xl w-full mt-2"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          </div>
        </form>

        <div className="mt-6 flex justify-end gap-4">
            <button className="px-6 py-3 rounded-md border border-neutral-400 hover:bg-neutral-200/50 transition-all duration-200 cursor-pointer">Cancel</button>
            <button className="px-6 py-3 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer">Register User</button>
        </div>
      </div>
    </div>
  );
}
