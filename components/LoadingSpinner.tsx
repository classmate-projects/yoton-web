export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative w-12 h-12">
        {/* Outer rotating ring */}
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 border-r-teal-500"
          style={{
            animation: "spin 0.8s linear infinite"
          }}
        />
        {/* Inner rotating ring */}
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-teal-400 border-l-teal-400"
          style={{
            animation: "spin 1.2s linear infinite reverse"
          }}
        />
        <style>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
