import Link from 'next/link';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

export default function Pagination({ currentPage, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
  if (totalPages <= 9) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 4) pages.push('ellipsis-left');
    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 3) pages.push('ellipsis-right');
    pages.push(totalPages);
  }

  const linkClass = "px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all";
  const disabledClass = "px-3 py-2 rounded-lg text-sm font-medium text-slate-300 cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      {currentPage > 1 ? (
        <Link href={buildHref(1)} className={linkClass} title="首页">«</Link>
      ) : (
        <span className={disabledClass}>«</span>
      )}
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className={linkClass}>上一页</Link>
      ) : (
        <span className={disabledClass}>上一页</span>
      )}

      {pages.map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="w-9 h-9 flex items-center justify-center text-sm text-slate-400">···</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
              currentPage === p
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700'
            }`}
          >
            {p}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} className={linkClass}>下一页</Link>
      ) : (
        <span className={disabledClass}>下一页</span>
      )}
      {currentPage < totalPages ? (
        <Link href={buildHref(totalPages)} className={linkClass} title="尾页">»</Link>
      ) : (
        <span className={disabledClass}>»</span>
      )}
    </div>
  );
}
