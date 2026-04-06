'use client';

/**
 * 优化后的法规管理页面 - 演示版本
 * 使用静态数据展示新设计效果
 */

import Link from 'next/link';
import OptimizedButton from '../../components/OptimizedButton';
import OptimizedTable from '../../components/OptimizedTable';
import OptimizedHeader from '../../components/OptimizedHeader';

// 模拟数据
const mockLaws = [
  {
    id: '1',
    title: '中华人民共和国公司法',
    level: '法律',
    category: '市场主体登记',
    status: '现行有效',
    issuingAuthority: '全国人民代表大会',
    promulgationDate: '2023-12-29',
  },
  {
    id: '2',
    title: '企业信息公示暂行条例',
    level: '行政法规',
    category: '信用监管',
    status: '已被修改',
    issuingAuthority: '国务院',
    promulgationDate: '2014-07-23',
  },
  {
    id: '3',
    title: '市场监督管理行政处罚程序规定',
    level: '部门规章',
    category: '执法办案',
    status: '现行有效',
    issuingAuthority: '国家市场监督管理总局',
    promulgationDate: '2021-07-02',
  },
];

// 表格列定义
const columns = [
  {
    key: 'title',
    title: '法规标题',
    width: 300,
    render: (record: any) => (
      <Link href={`/law/${record.id}`} target="_blank" className="law-link">
        {record.title}
      </Link>
    ),
  },
  {
    key: 'level',
    title: '位阶',
    width: 100,
    render: (record: any) => {
      const levelColors: Record<string, string> = {
        '法律': 'tag-accent',
        '行政法规': 'tag-warning',
        '部门规章': 'tag-success',
        '地方性法规': 'tag-secondary',
      };
      return <span className={`tag ${levelColors[record.level] || 'tag-default'}`}>{record.level}</span>;
    },
  },
  {
    key: 'category',
    title: '类别',
    width: 120,
  },
  {
    key: 'status',
    title: '时效性',
    width: 100,
    render: (record: any) => {
      const statusColors: Record<string, string> = {
        '现行有效': 'text-green-700',
        '已废止': 'text-red-600',
        '已被修改': 'text-blue-600',
        '尚未施行': 'text-orange-600',
      };
      return <span className={`status-badge ${statusColors[record.status] || ''}`}>{record.status}</span>;
    },
  },
  {
    key: 'issuingAuthority',
    title: '制定机关',
    width: 200,
  },
  {
    key: 'promulgationDate',
    title: '公布日期',
    width: 120,
    render: (record: any) => record.promulgationDate || '-',
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    render: (record: any) => (
      <div className="action-buttons">
        <Link href={`/admin/edit/${record.id}`}>
          <OptimizedButton size="sm" variant="ghost">
            编辑
          </OptimizedButton>
        </Link>
      </div>
    ),
  },
];

export default function DemoAdminPage() {
  const headerActions = (
    <>
      <Link href="/admin/create" target="_blank">
        <OptimizedButton
          variant="primary"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          }
        >
          录入新法规
        </OptimizedButton>
      </Link>
    </>
  );

  return (
    <div className="admin-page optimized-admin-page">
      <OptimizedHeader searchAction="/admin/laws" actions={headerActions} />

      <div className="admin-content-wrapper">
        {/* 页面标题 */}
        <div className="page-header">
          <h1 className="page-title">法规管理</h1>
          <p className="page-subtitle">管理和维护法规数据库</p>
        </div>

        {/* 统计信息 */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">显示结果</span>
            <span className="stat-value">{mockLaws.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">数据库总数</span>
            <span className="stat-value">1,234</span>
          </div>
        </div>

        {/* 表格 */}
        <OptimizedTable
          columns={columns}
          data={mockLaws}
          keyField="id"
          emptyText="暂无法规数据"
        />
      </div>

      <style jsx>{`
        .optimized-admin-page {
          min-height: 100vh;
          background: #faf8f5;
        }

        .admin-content-wrapper {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-title {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
        }

        .page-subtitle {
          font-family: 'Noto Sans SC', sans-serif;
          font-size: 0.875rem;
          color: #6b6b6b;
          font-style: italic;
        }

        .stats-bar {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 1rem 1.5rem;
          background: #ffffff;
          border: 1px solid #e8e6e3;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .stat-item {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b6b6b;
        }

        .stat-value {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #c8302b;
        }

        .law-link {
          font-weight: 600;
          color: #1a1a1a;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .law-link:hover {
          color: #c8302b;
        }

        .status-badge {
          font-weight: 600;
          font-size: 0.8125rem;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .action-buttons a {
          text-decoration: none;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid;
        }

        .tag-accent {
          background: rgba(200, 48, 43, 0.1);
          color: #c8302b;
          border-color: rgba(200, 48, 43, 0.2);
        }

        .tag-success {
          background: rgba(34, 139, 34, 0.1);
          color: #228b22;
          border-color: rgba(34, 139, 34, 0.2);
        }

        .tag-warning {
          background: rgba(220, 140, 40, 0.1);
          color: #dc8c28;
          border-color: rgba(220, 140, 40, 0.2);
        }

        .tag-secondary {
          background: rgba(107, 107, 107, 0.1);
          color: #6b6b6b;
          border-color: rgba(107, 107, 107, 0.2);
        }

        .text-green-700 {
          color: #15803d;
        }

        .text-red-600 {
          color: #dc2626;
        }

        .text-blue-600 {
          color: #2563eb;
        }

        .text-orange-600 {
          color: #ea580c;
        }
      `}</style>
    </div>
  );
}
