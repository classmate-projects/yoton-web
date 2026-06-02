export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="w-10 h-10 rounded-full border-[3px] border-teal-500/10 border-t-teal-500 animate-spin" />
    </div>
  );
}
