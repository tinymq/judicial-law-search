'use client';

import { useState } from 'react';
import Link from 'next/link';

type RegionGroup = {
  province: string;
  totalCount: number;
  provinceOwnCount: number;
  children: Array<{ name: string; count: number }>;
};

interface MobileFilterPanelProps {
  baseUrl: string;
  totalCount: number;
  levels: Array<{ level: string; _count: { id: number } }>;
  industries: Array<{ id: number; name: string; _count: number }>;
  regionGroups: RegionGroup[];
  years: Array<{ year: string; count: number }>;
  statuses: Array<{ status: string; _count: { id: number } }>;
  selectedIndustry: string;
  selectedLevel: string;
  selectedYear: string;
  selectedRegion: string;
  selectedStatus: string;
}

function buildUrl(baseUrl: string, params: Record<string, string>) {
  const filtered = Object.entries(params).filter(([, v]) => v);
  if (filtered.length === 0) return baseUrl;
  return `${baseUrl}?${filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export default function MobileFilterPanel({
  baseUrl,
  totalCount,
  levels,
  industries,
  regionGroups,
  years,
  statuses,
  selectedIndustry,
  selectedLevel,
  selectedYear,
  selectedRegion,
  selectedStatus,
}: MobileFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'level' | 'industry' | 'region' | 'year' | 'status'>('level');
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);

  const hasFilter = selectedIndustry || selectedLevel || selectedYear || selectedRegion || selectedStatus;
  const filterCount = [selectedIndustry, selectedLevel, selectedYear, selectedRegion, selectedStatus].filter(Boolean).length;

  const currentParams: Record<string, string> = {};
  if (selectedIndustry) currentParams.industry = selectedIndustry;
  if (selectedLevel) currentParams.level = selectedLevel;
  if (selectedYear) currentParams.year = selectedYear;
  if (selectedRegion) currentParams.region = selectedRegion;
  if (selectedStatus) currentParams.status = selectedStatus;

  const tabs = [
    { key: 'level' as const, label: '位阶', active: !!selectedLevel },
    { key: 'industry' as const, label: '行业', active: !!selectedIndustry },
    { key: 'region' as const, label: '区域', active: !!selectedRegion },
    { key: 'year' as const, label: '年份', active: !!selectedYear },
    { key: 'status' as const, label: '时效', active: !!selectedStatus },
  ];

  return (
    <div className="md:hidden">
      {/* Toggle button row */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            hasFilter
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          筛选{filterCount > 0 && ` (${filterCount})`}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {hasFilter && (
          <Link href={baseUrl} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
            重置
          </Link>
        )}
      </div>

      {/* Filter panel */}
      {open && (
        <div className="mx-3 mb-3 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-0 px-3 py-2 text-sm font-medium text-center whitespace-nowrap transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-blue-600'
                    : tab.active
                    ? 'text-blue-500'
                    : 'text-slate-500'
                }`}
              >
                {tab.label}
                {tab.active && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-3 max-h-48 overflow-y-auto">
            {activeTab === 'level' && (
              <div className="flex flex-wrap gap-2">
                {levels.map(item => {
                  const isSelected = selectedLevel === item.level;
                  const params = { ...currentParams };
                  if (isSelected) { delete params.level; } else { params.level = item.level; }
                  return (
                    <Link
                      key={item.level}
                      href={buildUrl(baseUrl, params)}
                      onClick={() => setOpen(false)}
                      className={`px-2.5 py-1 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.level} ({item._count.id})
                    </Link>
                  );
                })}
              </div>
            )}

            {activeTab === 'industry' && (
              <div className="flex flex-wrap gap-2">
                {industries.map(item => {
                  const isSelected = selectedIndustry === String(item.id);
                  const params = { ...currentParams };
                  if (isSelected) { delete params.industry; } else { params.industry = String(item.id); }
                  return (
                    <Link
                      key={item.id}
                      href={buildUrl(baseUrl, params)}
                      onClick={() => setOpen(false)}
                      className={`px-2.5 py-1 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.name} ({item._count})
                    </Link>
                  );
                })}
              </div>
            )}

            {activeTab === 'region' && (
              <div className="space-y-1">
                {regionGroups.map(group => {
                  const isProvinceSelected = selectedRegion === group.province;
                  const hasChildren = group.children.length > 0;
                  const isExpanded = expandedProvince === group.province;

                  return (
                    <div key={group.province}>
                      <div className="flex items-center gap-1">
                        {hasChildren ? (
                          <button
                            onClick={() => setExpandedProvince(isExpanded ? null : group.province)}
                            className="flex-1 flex items-center gap-1 px-2 py-1 rounded text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <svg className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                            <span className={isProvinceSelected || group.children.some(c => selectedRegion === c.name) ? 'text-blue-600 font-medium' : ''}>
                              {group.province} ({group.totalCount})
                            </span>
                          </button>
                        ) : (
                          <Link
                            href={buildUrl(baseUrl, { ...currentParams, region: isProvinceSelected ? '' : group.province })}
                            onClick={() => setOpen(false)}
                            className={`flex-1 px-2 py-1 rounded text-sm transition-colors ${
                              isProvinceSelected
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {group.province} ({group.totalCount})
                          </Link>
                        )}
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="pl-6 flex flex-wrap gap-1 mt-1 mb-2">
                          {group.provinceOwnCount > 0 && (
                            <Link
                              key={`${group.province}-own`}
                              href={buildUrl(baseUrl, { ...currentParams, region: isProvinceSelected ? '' : group.province })}
                              onClick={() => setOpen(false)}
                              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                isProvinceSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              省级 ({group.provinceOwnCount})
                            </Link>
                          )}
                          {group.children.map(city => {
                            const isCitySelected = selectedRegion === city.name;
                            return (
                              <Link
                                key={city.name}
                                href={buildUrl(baseUrl, { ...currentParams, region: isCitySelected ? '' : city.name })}
                                onClick={() => setOpen(false)}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  isCitySelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {city.name} ({city.count})
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'year' && (
              <div className="flex flex-wrap gap-2">
                {years.map(item => {
                  const isSelected = selectedYear === item.year;
                  const params = { ...currentParams };
                  if (isSelected) { delete params.year; } else { params.year = item.year; }
                  return (
                    <Link
                      key={item.year}
                      href={buildUrl(baseUrl, params)}
                      onClick={() => setOpen(false)}
                      className={`px-2.5 py-1 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.year} ({item.count})
                    </Link>
                  );
                })}
              </div>
            )}

            {activeTab === 'status' && (
              <div className="flex flex-wrap gap-2">
                {statuses.map(item => {
                  const isSelected = selectedStatus === item.status;
                  const params = { ...currentParams };
                  if (isSelected) { delete params.status; } else { params.status = item.status; }
                  return (
                    <Link
                      key={item.status}
                      href={buildUrl(baseUrl, params)}
                      onClick={() => setOpen(false)}
                      className={`px-2.5 py-1 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.status} ({item._count.id})
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
