'use client';

import { useState } from 'react';
import Link from 'next/link';

type RegionGroup = {
  province: string;
  totalCount: number;
  provinceOwnCount: number;
  children: Array<{ name: string; count: number }>;
};

interface LawSidebarProps {
  baseUrl: string;
  totalCount: number;
  levels: Array<{ level: string; _count: { id: number } }>;
  industries?: Array<{ id: number; name: string; _count: number }>;
  regionGroups: RegionGroup[];
  years: Array<{ year: string; count: number }>;
  statuses?: Array<{ status: string; _count: { id: number } }>;
  selectedIndustry?: string;
  selectedLevel?: string;
  selectedYear?: string;
  selectedRegion?: string;
  selectedStatus?: string;
}

export default function LawSidebar({
  baseUrl,
  totalCount,
  levels,
  industries = [],
  regionGroups,
  years,
  statuses = [],
  selectedIndustry = '',
  selectedLevel = '',
  selectedYear = '',
  selectedRegion = '',
  selectedStatus = '',
}: LawSidebarProps) {
  // 管理各分组的展开状态
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    level: true,
    status: true,
    industry: true,
    region: false,
    year: false,
  });

  // 管理省份展开状态
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(() => {
    // 如果当前选中了某个城市，自动展开其所在省份
    const initial = new Set<string>();
    if (selectedRegion) {
      for (const g of regionGroups) {
        if (g.province === selectedRegion || g.children.some(c => c.name === selectedRegion)) {
          initial.add(g.province);
        }
      }
    }
    return initial;
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleProvince = (province: string) => {
    setExpandedProvinces(prev => {
      const next = new Set(prev);
      if (next.has(province)) next.delete(province);
      else next.add(province);
      return next;
    });
  };

  // 构建查询参数的辅助函数
  const buildQueryString = (params: Record<string, string>) => {
    const filtered = Object.entries(params)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return filtered ? `?${filtered}` : '';
  };

  const baseParams = {
    industry: selectedIndustry,
    level: selectedLevel,
    year: selectedYear,
    region: selectedRegion,
    status: selectedStatus,
  };

  const SectionHeader = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between text-sm font-bold text-slate-800 mb-3 px-3 border-b-2 border-slate-200 cursor-pointer hover:text-slate-900"
    >
      <span>{label}</span>
      <svg className={`w-4 h-4 transition-transform ${openSections[id] ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
  );

  return (
    <div className="select-none">
      {/* 全部法规 */}
      <div className="sticky top-0 bg-slate-50 pb-2 z-10">
        <Link
          href={baseUrl}
          className={`flex items-center justify-between px-2 py-2 rounded text-sm font-bold transition-colors ${
            !selectedIndustry && !selectedLevel && !selectedYear && !selectedRegion && !selectedStatus
              ? 'bg-blue-100 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>全部法规</span>
          <span className="text-xs bg-black/5 px-2 py-0.5 rounded-full text-slate-500">
            {totalCount}
          </span>
        </Link>
      </div>

      <nav className="pr-2 space-y-4">
        {/* 效力位阶 */}
        <div>
          <SectionHeader id="level" label="按效力位阶" />
          {openSections.level && (
            <div className="space-y-0.5 pl-2 ml-1">
              {levels.map((lvl) => (
                <Link
                  key={lvl.level}
                  href={`${baseUrl}${buildQueryString({ ...baseParams, level: lvl.level })}`}
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
          )}
        </div>

        {/* 时效性 */}
        <div>
          <SectionHeader id="status" label="按时效性" />
          {openSections.status && (
            <div className="space-y-0.5 pl-2 ml-1">
              {statuses.map((stat) => (
                <Link
                  key={stat.status}
                  href={`${baseUrl}${buildQueryString({ ...baseParams, status: stat.status })}`}
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
          )}
        </div>

        {/* 行业分类 */}
        {industries.length > 0 && (
          <div>
            <SectionHeader id="industry" label="按行业" />
            {openSections.industry && (
              <div className="space-y-0.5 pl-2 ml-1">
                {industries.map((ind) => (
                  <Link
                    key={ind.id}
                    href={`${baseUrl}${buildQueryString({ ...baseParams, industry: String(ind.id) })}`}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedIndustry === String(ind.id)
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-800 hover:bg-blue-50'
                    }`}
                  >
                    <span className="truncate">{ind.name}</span>
                    <span className="text-xs font-semibold text-slate-600">{ind._count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 区域分类 - 省市折叠展开 */}
        <div>
          <SectionHeader id="region" label="按区域" />
          {openSections.region && (
            <div className="space-y-0.5 pl-2 ml-1">
              {regionGroups.map((group) => {
                const isProvinceSelected = selectedRegion === group.province;
                const isExpanded = expandedProvinces.has(group.province);

                if (group.children.length === 0) {
                  return (
                    <Link
                      key={group.province}
                      href={`${baseUrl}${buildQueryString({ ...baseParams, region: group.province })}`}
                      className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                        isProvinceSelected
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-800 hover:bg-blue-50'
                      }`}
                    >
                      <span className="truncate">{group.province}</span>
                      <span className="text-xs font-semibold text-slate-600">{group.totalCount}</span>
                    </Link>
                  );
                }

                return (
                  <div key={group.province}>
                    <button
                      onClick={() => toggleProvince(group.province)}
                      className="w-full flex items-center px-2 py-1.5 rounded text-sm hover:bg-blue-50 transition-colors"
                    >
                      <span className="w-4 h-4 flex items-center justify-center mr-1 shrink-0 text-slate-400">
                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </span>
                      <span className={`truncate flex-1 text-left ${
                        isProvinceSelected || group.children.some(c => selectedRegion === c.name)
                          ? 'text-blue-700 font-medium' : 'text-slate-800'
                      }`}>
                        {group.province}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">{group.totalCount}</span>
                    </button>
                    {isExpanded && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {/* 省级法规入口 */}
                        {group.provinceOwnCount > 0 && (
                          <Link
                            href={`${baseUrl}${buildQueryString({ ...baseParams, region: group.province })}`}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                              isProvinceSelected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-600 hover:bg-blue-50'
                            }`}
                          >
                            <span>省级法规</span>
                            <span className="text-xs text-slate-400">{group.provinceOwnCount}</span>
                          </Link>
                        )}
                        {group.children.map((city) => (
                          <Link
                            key={city.name}
                            href={`${baseUrl}${buildQueryString({ ...baseParams, region: city.name })}`}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                              selectedRegion === city.name
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-500 hover:bg-blue-50 hover:text-slate-700'
                            }`}
                          >
                            <span className="truncate">{city.name}</span>
                            <span className="text-xs text-slate-400">{city.count}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 年份分类 */}
        <div>
          <SectionHeader id="year" label="按年份" />
          {openSections.year && (
            <div className="space-y-0.5 pl-2 ml-1">
              {years.map((y) => (
                <Link
                  key={y.year}
                  href={`${baseUrl}${buildQueryString({ ...baseParams, year: y.year })}`}
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
          )}
        </div>
      </nav>
    </div>
  );
}
