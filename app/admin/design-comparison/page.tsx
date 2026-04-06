'use client';

/**
 * 设计对比页面
 * 展示优化前后的设计对比
 */

import Link from 'next/link';

export default function DesignComparisonPage() {
  return (
    <div className="comparison-page">
      <div className="comparison-container">
        {/* 标题 */}
        <div className="comparison-header">
          <h1>管理后台设计对比</h1>
          <p className="subtitle">精致官僚现代主义 vs 通用AI美学</p>
        </div>

        {/* 对比卡片 */}
        <div className="comparison-grid">
          {/* 旧设计 */}
          <div className="design-card old-design">
            <div className="card-header">
              <span className="badge badge-old">优化前</span>
              <h2>通用AI美学</h2>
            </div>
            <div className="card-body">
              <ul className="feature-list">
                <li className="feature negative">
                  <span className="icon">❌</span>
                  <div>
                    <strong>Geist 字体</strong>
                    <p>通用的AI选择，缺乏个性</p>
                  </div>
                </li>
                <li className="feature negative">
                  <span className="icon">❌</span>
                  <div>
                    <strong>灰色系配色</strong>
                    <p>大量 slate 色系，单调乏味</p>
                  </div>
                </li>
                <li className="feature negative">
                  <span className="icon">❌</span>
                  <div>
                    <strong>标准布局</strong>
                    <p>千篇一律的表格+卡片</p>
                  </div>
                </li>
                <li className="feature negative">
                  <span className="icon">❌</span>
                  <div>
                    <strong>基本无动画</strong>
                    <p>缺少交互反馈和视觉惊喜</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="card-footer">
              <Link href="/admin/laws" className="btn btn-view">
                查看旧版 →
              </Link>
            </div>
          </div>

          {/* 新设计 */}
          <div className="design-card new-design">
            <div className="card-header">
              <span className="badge badge-new">优化后</span>
              <h2>精致官僚现代主义</h2>
            </div>
            <div className="card-body">
              <ul className="feature-list">
                <li className="feature positive">
                  <span className="icon">✅</span>
                  <div>
                    <strong>Noto Serif SC 字体</strong>
                    <p>宋体风格，权威且独特</p>
                  </div>
                </li>
                <li className="feature positive">
                  <span className="icon">✅</span>
                  <div>
                    <strong>朱红色主题</strong>
                    <p>呼应国徽，政府系统专属</p>
                  </div>
                </li>
                <li className="feature positive">
                  <span className="icon">✅</span>
                  <div>
                    <strong>米白色背景</strong>
                    <p>纸张质感，精致舒适</p>
                  </div>
                </li>
                <li className="feature positive">
                  <span className="icon">✅</span>
                  <div>
                    <strong>优雅动画</strong>
                    <p>流畅过渡，提升体验</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="card-footer">
              <Link href="/admin/laws/demo" className="btn btn-primary">
                查看新版 →
              </Link>
            </div>
          </div>
        </div>

        {/* 设计理念 */}
        <div className="design-philosophy">
          <h2>设计理念</h2>
          <div className="philosophy-grid">
            <div className="philosophy-item">
              <div className="icon-wrapper">🎯</div>
              <h3>拥抱官僚美学</h3>
              <p>既然是政府系统，我们用宋体和朱红色强化权威感，而不是假装成时尚科技产品。</p>
            </div>
            <div className="philosophy-item">
              <div className="icon-wrapper">📜</div>
              <h3>纸张质感</h3>
              <p>米白色背景+subtle纹理，营造处理正式文件的庄重感。</p>
            </div>
            <div className="philosophy-item">
              <div className="icon-wrapper">✨</div>
              <h3>现代精致</h3>
              <p>大量留白+精确网格+流畅动画，将传统美学用现代设计语言重新诠释。</p>
            </div>
          </div>
        </div>

        {/* 组件库 */}
        <div className="component-showcase">
          <h2>优化后的组件库</h2>
          <div className="component-grid">
            <div className="component-item">
              <h3>按钮</h3>
              <div className="button-showcase">
                <button className="btn-demo btn-primary">主要操作</button>
                <button className="btn-demo btn-secondary">次要操作</button>
                <button className="btn-demo btn-danger">危险操作</button>
                <button className="btn-demo btn-ghost">幽灵按钮</button>
              </div>
            </div>
            <div className="component-item">
              <h3>标签</h3>
              <div className="tag-showcase">
                <span className="tag-demo tag-accent">法律</span>
                <span className="tag-demo tag-success">有效</span>
                <span className="tag-demo tag-warning">修改</span>
              </div>
            </div>
            <div className="component-item">
              <h3>表格</h3>
              <p className="component-desc">精致的表格样式，流畅的排序交互</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .comparison-page {
          min-height: 100vh;
          background: #faf8f5;
          font-family: 'Noto Sans SC', sans-serif;
          padding: 2rem;
        }

        .comparison-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .comparison-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .comparison-header h1 {
          font-family: 'Noto Serif SC', serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          font-size: 1.125rem;
          color: #6b6b6b;
          font-style: italic;
        }

        /* 对比网格 */
        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
          margin-bottom: 4rem;
        }

        .design-card {
          background: #ffffff;
          border: 1px solid #e8e6e3;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 1px 3px rgba(26, 26, 26, 0.06),
            0 1px 2px rgba(26, 26, 26, 0.04);
          transition: all 0.3s ease;
        }

        .design-card:hover {
          box-shadow:
            0 8px 24px rgba(26, 26, 26, 0.12),
            0 1px 3px rgba(26, 26, 26, 0.06);
          transform: translateY(-2px);
        }

        .new-design {
          border-color: #c8302b;
          border-width: 2px;
        }

        .card-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e8e6e3;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .new-design .card-header {
          background: linear-gradient(to right, rgba(200, 48, 43, 0.05), transparent);
        }

        .badge {
          padding: 0.375rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-old {
          background: #f5f3f0;
          color: #6b6b6b;
        }

        .badge-new {
          background: #c8302b;
          color: #ffffff;
        }

        .card-header h2 {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0;
        }

        .card-body {
          padding: 1.5rem;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 0.75rem;
        }

        .feature.negative {
          background: rgba(220, 38, 38, 0.05);
        }

        .feature.positive {
          background: rgba(34, 139, 34, 0.05);
        }

        .feature .icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .feature strong {
          display: block;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 0.25rem;
        }

        .feature p {
          font-size: 0.875rem;
          color: #6b6b6b;
          margin: 0;
        }

        .card-footer {
          padding: 1.5rem;
          border-top: 1px solid #e8e6e3;
          text-align: center;
        }

        .btn {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .btn-view {
          background: #f5f3f0;
          color: #6b6b6b;
          border: 1px solid #e8e6e3;
        }

        .btn-view:hover {
          background: #e8e6e3;
        }

        .btn-primary {
          background: #c8302b;
          color: #ffffff;
          border: 1px solid #c8302b;
        }

        .btn-primary:hover {
          background: #a82723;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(200, 48, 43, 0.15);
        }

        /* 设计理念 */
        .design-philosophy {
          margin-bottom: 4rem;
        }

        .design-philosophy h2 {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .philosophy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .philosophy-item {
          background: #ffffff;
          border: 1px solid #e8e6e3;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        }

        .icon-wrapper {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .philosophy-item h3 {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .philosophy-item p {
          font-size: 0.875rem;
          color: #6b6b6b;
          line-height: 1.6;
        }

        /* 组件展示 */
        .component-showcase {
          background: #ffffff;
          border: 1px solid #e8e6e3;
          border-radius: 8px;
          padding: 2rem;
        }

        .component-showcase h2 {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 1.5rem;
        }

        .component-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
        }

        .component-item h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #6b6b6b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }

        .button-showcase {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .btn-demo {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-demo.btn-primary {
          background: #c8302b;
          color: #ffffff;
        }

        .btn-demo.btn-secondary {
          background: #ffffff;
          color: #1a1a1a;
          border: 1px solid #e8e6e3;
        }

        .btn-demo.btn-danger {
          background: #dc2626;
          color: #ffffff;
        }

        .btn-demo.btn-ghost {
          background: transparent;
          color: #6b6b6b;
        }

        .tag-showcase {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag-demo {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid;
        }

        .tag-demo.tag-accent {
          background: rgba(200, 48, 43, 0.1);
          color: #c8302b;
          border-color: rgba(200, 48, 43, 0.2);
        }

        .tag-demo.tag-success {
          background: rgba(34, 139, 34, 0.1);
          color: #228b22;
          border-color: rgba(34, 139, 34, 0.2);
        }

        .tag-demo.tag-warning {
          background: rgba(220, 140, 40, 0.1);
          color: #dc8c28;
          border-color: rgba(220, 140, 40, 0.2);
        }

        .component-desc {
          font-size: 0.875rem;
          color: #6b6b6b;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
