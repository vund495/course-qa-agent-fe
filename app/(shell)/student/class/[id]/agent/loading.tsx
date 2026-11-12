export default function StudentAgentLoading() {
  return (
    <div className="-mx-6 flex h-full min-h-0 flex-1 overflow-hidden border-x border-b border-[#DADADA] bg-white">
      <div className="hidden w-64 shrink-0 flex-col border-r border-[#DADADA] md:flex">
        <div className="flex h-[92px] shrink-0 items-center border-b border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)] px-3">
          <span className="text-[13.5px] font-semibold text-white">Chat History</span>
        </div>
        <div className="space-y-2 p-2">
          <div className="skeleton-shimmer h-8 w-full rounded-md bg-[#E4E8ED]" />
          <div className="skeleton-shimmer h-8 w-full rounded-md bg-[#E4E8ED]" />
          <div className="skeleton-shimmer h-10 w-full rounded-lg bg-[#EDF0F4]" />
          <div className="skeleton-shimmer h-10 w-full rounded-lg bg-[#EDF0F4]" />
          <div className="skeleton-shimmer h-10 w-full rounded-lg bg-[#EDF0F4]" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[92px] shrink-0 items-center border-b border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)] px-4">
          <span className="text-[13.5px] font-semibold text-white">Course AI Assistant</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <div className="skeleton-shimmer h-6 w-64 rounded-md bg-[#E4E8ED]" />
          <div className="skeleton-shimmer h-4 w-96 rounded-md bg-[#EDF0F4]" />
          <div className="skeleton-shimmer mt-4 h-24 w-full max-w-2xl rounded-xl bg-[#F2F4F7]" />
        </div>
      </div>
    </div>
  );
}
