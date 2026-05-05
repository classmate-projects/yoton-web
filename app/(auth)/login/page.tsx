export default function LoginPage() {
  return (
    <div className="h-screen w-full bg-gray-100 flex justify-center items-center">
      <div className=" px-12 py-8 rounded-2xl shadow-lg border-t border-gray-200 bg-white w-1/3 flex flex-col gap-4 justify-between items-center">
        <div className=" flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold text-blue-500 text-center">
            Login Page
          </h1>
          <p className="text-sm text-black/60">Welcome back to Yoton</p>
        </div>

        <form className=" w-full flex flex-col gap-6">
          <div className="">
            <input 
            type="email" 
            id="email" 
            name="email" 
            placeholder="Enter your email"
            className="outline-none w-full px-4 py-2 rounded-xl shadow-md border-t border-gray-200/70"
            required />
          </div>
          <div>
            <input type="password" 
            id="password" 
            name="password" 
            placeholder="Enter your password"
            className="outline-none w-full px-4 py-2 rounded-xl shadow-md border-t border-gray-200/70"
            required />
          </div>
          <button 
          className="bg-blue-500 py-2 text-white rounded-xl text-xl hover:bg-blue-600 transition-all duration-200 cursor-pointer mt-4"
          type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
