import Link from 'next/link';

type FilterBarLevel = { level: string; _count: { id: number } };
type FilterBarStatus = { status: string; _count: { id: number } };
type FilterBarRegionGroup = {
  province: string;
  totalCount: number;
  provinceOwnCount: number;
  children: Array<{ name: string; count: number }>;
};
type FilterBarIndustry = {
  id: number;
  name: string;
  _count: number;
  children: Array<{ id: number; name: string; _count: number }>;
};
type FilterBarYear = { year: string; count: number };

type LawFilterBarProps = {
  query: string;
  levels: FilterBarLevel[];
  statuses: FilterBarStatus[];
  regionGroups: FilterBarRegionGroup[];
  industries: FilterBarIndustry[];
  years: FilterBarYear[];
  selectedLevel: string;
  selectedStatus: string;
  selectedRegion: string;
  selectedIndustry: string;
  selectedYear: string;
  buildHref: (overrides: Record<string, string>) => string;
};

const pillDefault = "px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors";
const pillActive = "px-3 py-1.5 rounded-md text-sm font-medium bg-slate-800 text-white shadow-sm";

export default function LawFilterBar({
  query, levels, statuses, regionGroups, industries, years,
  selectedLevel, selectedStatus, selectedRegion, selectedIndustry, selectedYear,
  buildHref,
}: LawFilterBarProps) {
  const selectedIndId = selectedIndustry ? parseInt(selectedIndustry) : null;
  const selectedL1Industry = selectedIndId
    ? industries.find(i => i.id === selectedIndId)
    : null;
  const selectedL2Parent = !selectedL1Industry && selectedIndId
    ? industries.find(i => i.children.some(c => c.id === selectedIndId))
    : null;
  const expandedIndustry = selectedL1Industry || selectedL2Parent;

  const selectedRegionGroup = selectedRegion
    ? regionGroups.find(g => g.province === selectedRegion || g.children.some(c => c.name === selectedRegion))
    : null;
  const showCities = selectedRegionGroup && selectedRegionGroup.children.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-4 mb-6 space-y-3">
      {/* Search */}
      <form className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="搜索法规名称、制定机关、文号..."
          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-base focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all outline-none"
        />
        {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
        {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
        {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
        {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
        {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
      </form>

      <div className="space-y-2.5">
        {/* Level */}
        <FilterRow label="位阶">
          {levels.map(l => (
            <Link
              key={l.level}
              href={buildHref({ level: selectedLevel === l.level ? '' : l.level })}
              className={selectedLevel === l.level ? pillActive : pillDefault}
            >
              {l.level}
              <span className="ml-1 opacity-50">{l._count.id}</span>
            </Link>
          ))}
        </FilterRow>

        {/* Status */}
        <FilterRow label="时效">
          {statuses.map(s => (
            <Link
              key={s.status}
              href={buildHref({ status: selectedStatus === s.status ? '' : s.status })}
              className={selectedStatus === s.status ? pillActive : pillDefault}
            >
              {s.status}
              <span className="ml-1 opacity-50">{s._count.id}</span>
            </Link>
          ))}
        </FilterRow>

        {/* Region */}
        <div>
          <FilterRow label="区域">
            {regionGroups.map(g => (
              <Link
                key={g.province}
                href={buildHref({ region: selectedRegion === g.province ? '' : g.province })}
                className={selectedRegion === g.province ? pillActive : pillDefault}
              >
                {g.province}
                <span className="ml-1 opacity-50">{g.totalCount}</span>
              </Link>
            ))}
          </FilterRow>
          {showCities && (
            <div className="ml-14 mt-1.5 flex items-start gap-2">
              <span className="text-xs text-slate-400 shrink-0 pt-1">城市</span>
              <div className="flex gap-1.5 flex-wrap">
                {selectedRegionGroup!.provinceOwnCount > 0 && (
                  <Link
                    href={buildHref({ region: selectedRegion === selectedRegionGroup!.province ? '' : selectedRegionGroup!.province })}
                    className={selectedRegion === selectedRegionGroup!.province ? pillActive : pillDefault}
                  >
                    省级 <span className="ml-1 opacity-50">{selectedRegionGroup!.provinceOwnCount}</span>
                  </Link>
                )}
                {selectedRegionGroup!.children.map(c => (
                  <Link
                    key={c.name}
                    href={buildHref({ region: selectedRegion === c.name ? '' : c.name })}
                    className={selectedRegion === c.name ? pillActive : pillDefault}
                  >
                    {c.name}
                    <span className="ml-1 opacity-50">{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Industry */}
        <div>
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">行业</span>
            <div className="flex-1 min-w-0">
              <div className="flex gap-1.5 flex-wrap">
                {industries.slice(0, 10).map(ind => (
                  <Link
                    key={ind.id}
                    href={buildHref({ industry: selectedIndustry === String(ind.id) ? '' : String(ind.id) })}
                    className={selectedIndustry === String(ind.id) || (selectedL2Parent?.id === ind.id) ? pillActive : pillDefault}
                  >
                    {ind.name}
                    <span className="ml-1 opacity-50">{ind._count}</span>
                  </Link>
                ))}
              </div>
              {industries.length > 10 && (
                <details className="mt-1.5" open={!!selectedIndId && industries.slice(10).some(i => i.id === selectedIndId || i.children.some(c => c.id === selectedIndId))}>
                  <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none [&::-webkit-details-marker]:hidden">
                    +{industries.length - 10} 个行业
                  </summary>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {industries.slice(10).map(ind => (
                      <Link
                        key={ind.id}
                        href={buildHref({ industry: selectedIndustry === String(ind.id) ? '' : String(ind.id) })}
                        className={selectedIndustry === String(ind.id) || (selectedL2Parent?.id === ind.id) ? pillActive : pillDefault}
                      >
                        {ind.name}
                        <span className="ml-1 opacity-50">{ind._count}</span>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
          {expandedIndustry && expandedIndustry.children.length > 0 && (
            <div className="ml-14 mt-1.5 flex items-start gap-2">
              <span className="text-xs text-slate-400 shrink-0 pt-1">二级</span>
              <div className="flex gap-1.5 flex-wrap">
                {expandedIndustry.children.map(c => (
                  <Link
                    key={c.id}
                    href={buildHref({ industry: selectedIndustry === String(c.id) ? '' : String(c.id) })}
                    className={selectedIndustry === String(c.id) ? pillActive : pillDefault}
                  >
                    {c.name}
                    <span className="ml-1 opacity-50">{c._count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Year */}
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">年份</span>
          <div className="flex-1 min-w-0">
            <div className="flex gap-1.5 flex-wrap">
              {years.slice(0, 6).map(y => (
                <Link
                  key={y.year}
                  href={buildHref({ year: selectedYear === y.year ? '' : y.year })}
                  className={selectedYear === y.year ? pillActive : pillDefault}
                >
                  {y.year}
                  <span className="ml-1 opacity-50">{y.count}</span>
                </Link>
              ))}
            </div>
            {years.length > 6 && (
              <details className="mt-1.5" open={!!selectedYear && years.slice(6).some(y => y.year === selectedYear)}>
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none [&::-webkit-details-marker]:hidden">
                  +{years.length - 6} 个年份
                </summary>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {years.slice(6).map(y => (
                    <Link
                      key={y.year}
                      href={buildHref({ year: selectedYear === y.year ? '' : y.year })}
                      className={selectedYear === y.year ? pillActive : pillDefault}
                    >
                      {y.year}
                      <span className="ml-1 opacity-50">{y.count}</span>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-400 w-12 shrink-0">{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {children}
      </div>
    </div>
  );
}
