'use client';

import { ReactNode } from 'react';

interface Column {
  key: string;
  title: string;
  width?: number;
  sortable?: boolean;
  render?: (record: any) => ReactNode;
}

interface OptimizedTableProps {
  columns: Column[];
  data: any[];
  keyField: string;
  onSort?: (column: string) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  emptyText?: string;
  rowClassName?: (record: any) => string;
  onRowClick?: (record: any) => void;
}

/**
 * 优化后的表格组件
 * - 精致的表格样式
 * - 流畅的排序交互
 * - 优雅的悬停效果
 */
export default function OptimizedTable({
  columns,
  data,
  keyField,
  onSort,
  sortField,
  sortOrder,
  emptyText = '暂无数据',
  rowClassName,
  onRowClick,
}: OptimizedTableProps) {
  const renderSortIcon = (column: Column) => {
    if (!column.sortable || !onSort) return null;
    const isActive = sortField === column.key;
    const isAsc = sortOrder === 'asc';

    return (
      <svg
        className={`sort-icon ${isActive ? 'active' : ''}`}
        style={{
          transform: isAsc ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  };

  return (
    <div className="optimized-table-wrapper">
      <div className="optimized-table-container">
        <table className="optimized-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={column.sortable && onSort ? 'sortable' : ''}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <span className="th-content">
                    {column.title}
                    {renderSortIcon(column)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={columns.length}>
                  <div className="empty-state">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="empty-icon"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <p className="empty-text">{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((record, index) => (
                <tr
                  key={record[keyField]}
                  className={rowClassName?.(record)}
                  onClick={() => onRowClick?.(record)}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(record)
                        : record[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .optimized-table-wrapper {
          background: #ffffff;
          border: 1px solid #e8e6e3;
          border-radius: 8px;
          overflow: hidden;
          box-shadow:
            0 1px 3px rgba(26, 26, 26, 0.06),
            0 1px 2px rgba(26, 26, 26, 0.04);
        }

        .optimized-table-container {
          overflow-x: auto;
          max-height: calc(100vh - 320px);
        }

        .optimized-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Noto Sans SC', sans-serif;
        }

        /* 表头 */
        thead {
          background: linear-gradient(to bottom, #faf8f5, #f5f3f0);
          border-bottom: 2px solid #c8302b;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        th {
          padding: 1rem 1.25rem;
          text-align: left;
          font-family: 'Noto Serif SC', serif;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b6b6b;
          white-space: nowrap;
          user-select: none;
        }

        th.sortable {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        th.sortable:hover {
          background: rgba(200, 48, 43, 0.05);
        }

        .th-content {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .sort-icon {
          color: #d1d1d1;
          transition: all 0.2s ease;
        }

        .sort-icon.active {
          color: #c8302b;
        }

        /* 表格行 */
        tbody tr {
          border-bottom: 1px solid #f0ede9;
          transition: all 0.15s ease;
          animation: fadeInUp 0.3s ease both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        tbody tr:hover {
          background: rgba(200, 48, 43, 0.03);
        }

        tbody tr:last-child {
          border-bottom: none;
        }

        td {
          padding: 1rem 1.25rem;
          font-size: 0.875rem;
          color: #1a1a1a;
        }

        /* 空状态 */
        .empty-row td {
          padding: 3rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #9b9b9b;
        }

        .empty-icon {
          opacity: 0.3;
        }

        .empty-text {
          font-family: 'Noto Serif SC', serif;
          font-size: 1rem;
          font-style: italic;
        }

        /* 滚动条样式 */
        .optimized-table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .optimized-table-container::-webkit-scrollbar-track {
          background: #faf8f5;
        }

        .optimized-table-container::-webkit-scrollbar-thumb {
          background: #e0dedb;
          border-radius: 4px;
        }

        .optimized-table-container::-webkit-scrollbar-thumb:hover {
          background: #d0d0d0;
        }
      `}</style>
    </div>
  );
}
