'use client'

import { useState } from 'react';
import { exportLawsToJson } from '../actions';

export default function ExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!confirm('确定要将数据库中的所有法规导出到 laws-exported 文件夹吗？\n\n注意：原始 laws 文件夹的文件不会被覆盖。')) return;
    
    setLoading(true);
    try {
      const res = await exportLawsToJson();
      alert(res.message);
    } catch (e: any) {
      alert('导出失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm shadow-green-200 disabled:opacity-50"
      style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
    >
      {loading ? '导出中...' : '导出 JSON'}
    </button>
  );
}
