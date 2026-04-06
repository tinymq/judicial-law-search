import Link from 'next/link';

interface LawSidebarProps {
  baseUrl: string;
  totalCount: number;
  levels: Array<{ level: string; _count: { id: number } }>;
  categories: Array<{ category: string; _count: { id: number } }>;
  regions: Array<{ region: string; _count: { id: number } }>;
  years: Array<{ year: string; count: number }>;
  statuses?: Array<{ status: string; _count: { id: number } }>;
  selectedCategory?: string;
  selectedLevel?: string;
  selectedYear?: string;
  selectedRegion?: string;
  selectedStatus?: string;
}

export default function LawSidebar({
  baseUrl,
  totalCount,
  levels,
  categories,
  regions,
  years,
  statuses = [],
  selectedCategory = '',
  selectedLevel = '',
  selectedYear = '',
  selectedRegion = '',
  selectedStatus = '',
}: LawSidebarProps) {
  // 构建查询参数的辅助函数
  const buildQueryString = (params: Record<string, string>) => {
    const filtered = Object.entries(params)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return filtered ? `?${filtered}` : '';
  };

  return (
    <div className="select-none">
      {/* 固定的"全部法规"或"全部违法行为" - 紧跟查询按钮下方 */}
      <div className="sticky top-0 bg-slate-50 pb-2 z-10">
        <Link
          href={baseUrl}
          className={`flex items-center justify-between px-2 py-2 rounded text-sm font-bold transition-colors ${
            !selectedCategory && !selectedLevel && !selectedYear && !selectedRegion
              ? 'bg-blue-100 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>{baseUrl.includes('/violations') ? '全部违法行为' : '全部法规'}</span>
          <span className="text-xs bg-black/5 px-2 py-0.5 rounded-full text-slate-500">
            {totalCount}
          </span>
        </Link>
      </div>

      {/* 分类列表 - 跟随页面滚动，无高度限制 */}
      <nav className="pr-2 space-y-4">
        {/* 第一组：效力位阶 */}
        <details className="group" open>
          <summary className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900">
            <span>按效力位阶</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <div className="space-y-0.5 pl-2 ml-1">
            {levels.map((lvl) => (
              <Link
                key={lvl.level}
                href={`${baseUrl}${buildQueryString({
                  level: lvl.level,
                  category: selectedCategory,
                  year: selectedYear,
                  region: selectedRegion,
                })}`}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedLevel === lvl.level
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-800 hover:bg-blue-50'
                }`}
              >
                <span className="truncate">{lvl.level}</span>
                <span className="text-xs font-semibold text-slate-600">{lvl._count.id}</span>
              </Link>
            ))}
          </div>
        </details>

        {/* 第二组：时效性 */}
        <details className="group" open>
          <summary className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900">
            <span>按时效性</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <div className="space-y-0.5 pl-2 ml-1">
            {statuses.map((stat) => (
              <Link
                key={stat.status}
                href={`${baseUrl}${buildQueryString({
                  status: stat.status,
                  category: selectedCategory,
                  level: selectedLevel,
                  year: selectedYear,
                  region: selectedRegion,
                })}`}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedStatus === stat.status
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-800 hover:bg-blue-50'
                }`}
              >
                <span className="truncate">{stat.status}</span>
                <span className="text-xs font-semibold text-slate-600">{stat._count.id}</span>
              </Link>
            ))}
          </div>
        </details>

        {/* 第三组：领域分类 */}
        <details className="group" open>
          <summary className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900">
            <span>按领域</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <div className="space-y-0.5 pl-2 ml-1">
            {categories.map((cat) => (
              <Link
                key={cat.category}
                href={`${baseUrl}${buildQueryString({
                  category: cat.category,
                  level: selectedLevel,
                  year: selectedYear,
                  region: selectedRegion,
                  status: selectedStatus,
                })}`}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedCategory === cat.category
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-800 hover:bg-blue-50'
                }`}
              >
                <span className="truncate">{cat.category}</span>
                <span className="text-xs font-semibold text-slate-600">{cat._count.id}</span>
              </Link>
            ))}
          </div>
        </details>

        {/* 第三组：区域分类 */}
        <details className="group">
          <summary className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900">
            <span>按区域</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <div className="space-y-0.5 pl-2 ml-1">
            {regions.map((reg) => (
              <Link
                key={reg.region}
                href={`${baseUrl}${buildQueryString({
                  region: reg.region,
                  category: selectedCategory,
                  level: selectedLevel,
                  year: selectedYear,
                  status: selectedStatus,
                })}`}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedRegion === reg.region
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-800 hover:bg-blue-50'
                }`}
              >
                <span className="truncate">{reg.region}</span>
                <span className="text-xs font-semibold text-slate-600">{reg._count.id}</span>
              </Link>
            ))}
          </div>
        </details>

        {/* 第四组：年份分类 */}
        <details className="group">
          <summary className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900">
            <span>按年份</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <div className="space-y-0.5 pl-2 ml-1">
            {years.map((y) => (
              <Link
                key={y.year}
                href={`${baseUrl}${buildQueryString({
                  year: y.year,
                  category: selectedCategory,
                  level: selectedLevel,
                  region: selectedRegion,
                  status: selectedStatus,
                })}`}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedYear === y.year
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-800 hover:bg-blue-50'
                }`}
              >
                <span>{y.year}年</span>
                <span className="text-xs font-semibold text-slate-600">{y.count}</span>
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}
