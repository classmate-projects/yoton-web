
interface SetPasswordPageType {
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    confirmPassword: string;
    setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
    handleSubmitNewPassword: (
        e: React.FormEvent<HTMLFormElement>
    ) => Promise<void>
    setshowAskEmail: React.Dispatch<React.SetStateAction<boolean>>;
    error: string;
}

export default function SetPasswordPage({
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    handleSubmitNewPassword,
    setshowAskEmail,
    error,
}: SetPasswordPageType,) {


    return (
        <>
            <div>
                <h1 className="text-3xl font-bold text-neutral-500">Update Password</h1>
            </div>
            <form onSubmit={handleSubmitNewPassword} className="flex flex-col gap-4 w-full px-4 mt-8">
                <div className="w-full flex flex-col gap-1">
                    <label htmlFor="password" className="required">Password</label>
                    <input type="password"
                        placeholder="******"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="border border-neutral-300 px-4 py-2.5 rounded-lg"
                    />
                </div>
                <div className="w-full flex flex-col gap-1">
                    <label htmlFor="confirm_password" className="required">Confirm Password</label>
                    <input type="password"
                        placeholder="******"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="border border-neutral-300 px-4 py-2.5 rounded-lg"
                    />
                </div>


                <div className="w-full flex items-center gap-2 mt-4">
                    <button
                        type="button"
                        onClick={() => setshowAskEmail(true)}

                        className="w-full bg-gray-300 px-4 py-3 rounded-lg hover:bg-gray-500 hover:text-white transition-all duration-200 cursor-pointer">Cancel</button>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 px-4 py-3 rounded-lg text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer">Save</button>
                </div>
                <p className="h-8 text-center mt-2 text-red-500 mb-0">{error}</p>
            </form>
        </>
    )
}