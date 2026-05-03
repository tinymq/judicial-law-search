import Link from 'next/link';
import HoverDetails from './HoverDetails';

type FilterBarLevel = { level: string; _count: { id: number } };
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
  query, levels, regionGroups, industries, years,
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

  const activeFilterCount = [selectedLevel, selectedStatus, selectedRegion, selectedIndustry, selectedYear].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-4">
      <HoverDetails className="group">
        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-3">
          <form className="flex-1 min-w-0 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="搜索法规名称、制定机关、文号..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-base focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all outline-none cursor-text"
            />
            {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
            {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
            {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
            {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
            {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
          </form>
          <div data-hover-trigger className="shrink-0 inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-3 cursor-pointer select-none transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span className="text-sm font-medium text-slate-600">筛选</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white">{activeFilterCount}</span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </summary>

      <div className="space-y-2.5 mt-3 pt-3 border-t border-slate-100">
        {/* Level */}
        <FoldableFilterRow
          label="位阶"
          items={levels}
          visibleCount={10}
          isSelected={(l) => selectedLevel === l.level}
          renderItem={(l) => (
            <Link
              key={l.level}
              href={buildHref({ level: selectedLevel === l.level ? '' : l.level })}
              className={selectedLevel === l.level ? pillActive : pillDefault}
            >
              {l.level}
              <span className="ml-1 opacity-50">{l._count.id}</span>
            </Link>
          )}
          foldLabel="个位阶"
        />

        {/* Region */}
        <div>
          <FoldableFilterRow
            label="区域"
            items={regionGroups}
            visibleCount={10}
            isSelected={(g) => selectedRegion === g.province || g.children.some(c => c.name === selectedRegion)}
            renderItem={(g) => (
              <Link
                key={g.province}
                href={buildHref({ region: selectedRegion === g.province ? '' : g.province })}
                className={selectedRegion === g.province ? pillActive : pillDefault}
              >
                {g.province}
                <span className="ml-1 opacity-50">{g.totalCount}</span>
              </Link>
            )}
            foldLabel="个区域"
          />
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
          <FoldableFilterRow
            label="行业"
            items={industries}
            visibleCount={8}
            isSelected={(ind) => selectedIndustry === String(ind.id) || (selectedL2Parent?.id === ind.id) || ind.children.some(c => c.id === selectedIndId)}
            renderItem={(ind) => (
              <Link
                key={ind.id}
                href={buildHref({ industry: selectedIndustry === String(ind.id) ? '' : String(ind.id) })}
                className={selectedIndustry === String(ind.id) || (selectedL2Parent?.id === ind.id) ? pillActive : pillDefault}
              >
                {ind.name}
                <span className="ml-1 opacity-50">{ind._count}</span>
              </Link>
            )}
            foldLabel="个行业"
          />
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
        <FoldableFilterRow
          label="年份"
          items={years}
          visibleCount={10}
          isSelected={(y) => selectedYear === y.year}
          renderItem={(y) => (
            <Link
              key={y.year}
              href={buildHref({ year: selectedYear === y.year ? '' : y.year })}
              className={selectedYear === y.year ? pillActive : pillDefault}
            >
              {y.year}
              <span className="ml-1 opacity-50">{y.count}</span>
            </Link>
          )}
          foldLabel="个年份"
        />
      </div>
      </HoverDetails>
    </div>
  );
}

function FoldableFilterRow<T>({ label, items, visibleCount, isSelected, renderItem, foldLabel }: {
  label: string;
  items: T[];
  visibleCount: number;
  isSelected: (item: T) => boolean;
  renderItem: (item: T) => React.ReactNode;
  foldLabel: string;
}) {
  const hasMore = items.length > visibleCount;
  const foldedHasSelected = hasMore && items.slice(visibleCount).some(isSelected);

  return (
    <div className="flex items-start gap-2">
      <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 min-w-0">
        <div className="flex gap-1.5 flex-wrap">
          {items.slice(0, visibleCount).map(renderItem)}
        </div>
        {hasMore && (
          <details className="mt-1.5" open={foldedHasSelected}>
            <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none [&::-webkit-details-marker]:hidden pl-3">
              +{items.length - visibleCount} {foldLabel}
            </summary>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {items.slice(visibleCount).map(renderItem)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
