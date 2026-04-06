# 管理后台设计系统文档

## 🎨 设计理念：精致官僚现代主义 (Refined Bureaucratic Modern)

### 核心思想
既然是政府监管系统，我们不假装成时尚科技产品，而是**拥抱**官僚美学，并用现代设计语言提升它：

- **权威感** ← 宋体字体 + 朱红色点缀
- **现代感** ← 大量留白 + 精确网格 +微妙阴影
- **精致感** ← 纸张纹理 + 铜色装饰 + 流畅动画

---

## 📐 设计规范

### 配色方案

| 颜色名称 | HEX值 | 用途 |
|---------|-------|------|
| 米白背景 | `#faf8f5` | 主背景色 |
| 浅灰背景 | `#f5f3f0` | 次级背景、侧边栏 |
| 纯白 | `#ffffff` | 卡片、表格、内容区 |
| 深灰文字 | `#1a1a1a` | 主要文字 |
| 中灰文字 | `#6b6b6b` | 次要文字 |
| 浅灰文字 | `#9b9b9b` | 占位符、提示 |
| **朱红强调** | `#c8302b` | 主按钮、链接、强调 |
| 朱红深色 | `#a82723` | 悬停状态 |
| 边框灰 | `#e8e6e3` | 边框、分割线 |

### 字体系统

| 用途 | 字体 | 说明 |
|------|------|------|
| 标题/显示 | `Noto Serif SC` | 宋体风格，权威感 |
| 正文/UI | `Noto Sans SC` | 清晰易读 |
| 代码/数据 | `JetBrains Mono` | 等宽字体，数据感 |

**引入方式**：
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap');
```

### 间距系统

| 名称 | 大小 | 用途 |
|------|------|------|
| `--space-xs` | 0.25rem (4px) | 极小间距 |
| `--space-sm` | 0.5rem (8px) | 小间距 |
| `--space-md` | 1rem (16px) | 标准间距 |
| `--space-lg` | 1.5rem (24px) | 大间距 |
| `--space-xl` | 2rem (32px) | 超大间距 |
| `--space-2xl` | 3rem (48px) | 特大间距 |

### 圆角系统

| 尺寸 | 值 | 用途 |
|------|-----|------|
| `--radius-sm` | 4px | 小元素（标签、徽章） |
| `--radius-md` | 6px | 按钮、输入框 |
| `--radius-lg` | 8px | 卡片、面板 |

### 阴影系统

| 名称 | 效果 | 用途 |
|------|------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 轻微浮起 |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.08)` | 中等浮起 |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | 强烈浮起 |
| `--shadow-paper` | 组合阴影 | 纸张质感 |

---

## 🧩 组件库

### 按钮 (OptimizedButton)

#### 变体

| 变体 | 样式 | 使用场景 |
|------|------|---------|
| `primary` | 朱红底白字 | 主要操作（保存、提交、创建） |
| `secondary` | 白底灰边 | 次要操作（取消、返回） |
| `danger` | 红色底白字 | 危险操作（删除、移除） |
| `ghost` | 透明底灰字 | 低调操作（编辑、查看） |

#### 尺寸

| 尺寸 | padding | 字体 |
|------|---------|------|
| `sm` | 0.375rem 0.75rem | 0.8125rem |
| `md` | 0.5rem 1rem | 0.875rem |
| `lg` | 0.75rem 1.5rem | 1rem |

#### 使用示例

```tsx
<OptimizedButton variant="primary" size="md">
  录入新法规
</OptimizedButton>

<OptimizedButton
  variant="primary"
  icon={<PlusIcon />}
  size="lg"
>
  创建
</OptimizedButton>
```

### 表格 (OptimizedTable)

#### 特性
- ✅ 可排序列
- ✅ 自定义渲染
- ✅ 空状态
- ✅ 流畅动画
- ✅ 悬停效果

#### 使用示例

```tsx
const columns = [
  {
    key: 'title',
    title: '法规标题',
    width: 300,
    render: (record) => <Link href={`/law/${record.id}`}>{record.title}</Link>
  },
  {
    key: 'level',
    title: '位阶',
    sortable: true,
    render: (record) => <span className="tag tag-accent">{record.level}</span>
  }
];

<OptimizedTable
  columns={columns}
  data={laws}
  keyField="id"
  sortField="level"
  sortOrder="asc"
  onSort={(field) => console.log('Sort by:', field)}
/>
```

### 标签 (Tag)

#### 类型

| 类名 | 配色 | 用途 |
|------|------|------|
| `tag-accent` | 朱红 | 重要信息 |
| `tag-success` | 绿色 | 成功状态 |
| `tag-warning` | 橙色 | 警告状态 |
| `tag-secondary` | 灰色 | 次要信息 |

#### 使用示例

```tsx
<span className="tag tag-accent">法律</span>
<span className="tag tag-success">现行有效</span>
<span className="tag tag-warning">已被修改</span>
```

---

## ✨ 动画规范

### 过渡时长

| 名称 | 时长 | 用途 |
|------|------|------|
| `--transition-fast` | 150ms | 快速反馈（悬停、焦点） |
| `--transition-normal` | 250ms | 标准过渡 |
| `--transition-slow` | 350ms | 复杂动画 |

### 标准动画

#### 淡入
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### 上浮淡入
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### 下滑
```css
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 使用建议

- ✅ 页面加载：使用 `fadeInUp` + `animation-delay` 错峰动画
- ✅ 表格行：逐行动画，`animation-delay: ${index * 0.03}s`
- ✅ 悬停状态：快速过渡 `150ms`
- ✅ 模态框：慢速过渡 `350ms`

---

## 📄 页面布局

### 标准页面结构

```
┌─────────────────────────────────────┐
│  顶部导航栏 (sticky, z-index: 100)  │
├─────────┬───────────────────────────┤
│         │                           │
│  侧边栏  │       主内容区            │
│ (280px) │                           │
│         │                           │
│         │                           │
└─────────┴───────────────────────────┘
```

### 顶部导航栏

- 高度：`auto` (padding: 1rem 2rem)
- 背景：白色
- 底边框：3px 朱红色
- 定位：`sticky top-0`
- 阴影：`--shadow-sm`

### 侧边栏

- 宽度：280px
- 背景：浅灰 (`#f5f3f0`)
- 右边框：1px
- 最大高度：`calc(100vh - 73px)`
- 溢出：滚动

### 主内容区

- 最大宽度：1400px
- 内边距：2rem
- 背景：米白色 (`#faf8f5`)

---

## 🚀 使用指南

### 1. 快速开始

在管理后台页面中使用新组件：

```tsx
import OptimizedHeader from '@/app/admin/components/OptimizedHeader';
import OptimizedButton from '@/app/admin/components/OptimizedButton';
import OptimizedTable from '@/app/admin/components/OptimizedTable';

export default function MyAdminPage() {
  return (
    <div className="admin-page">
      <OptimizedHeader />
      {/* 页面内容 */}
    </div>
  );
}
```

### 2. 字体已全局引入

`app/globals.css` 中已引入所有字体，无需额外配置。

### 3. 配色变量已全局可用

使用 CSS 变量保持一致性：

```css
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
```

---

## 📚 文件索引

### 组件文件

| 文件 | 说明 |
|------|------|
| `app/admin/components/OptimizedAdminLayout.tsx` | 布局容器 |
| `app/admin/components/OptimizedHeader.tsx` | 顶部导航栏 |
| `app/admin/components/OptimizedTable.tsx` | 数据表格 |
| `app/admin/components/OptimizedButton.tsx` | 按钮组件 |

### 示例页面

| 文件 | 说明 |
|------|------|
| `app/admin/laws/optimized-page.tsx` | 优化后的法规管理页 |
| `app/admin/design-comparison/page.tsx` | 新旧设计对比页 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `app/globals.css` | 全局样式和字体引入 |
| `app/layout.tsx` | 根布局（已移除Geist字体） |

---

## 🎯 设计原则

### ✅ 应该做的

1. **拥抱权威感**：使用宋体字体和朱红色，不要害怕"官僚"风格
2. **留白充足**：不要吝啬间距，大量留白提升精致感
3. **微妙动画**：subtle 胜过炫技，流畅胜过花哨
4. **保持一致**：严格使用设计系统的颜色、字体、间距

### ❌ 不应该做的

1. ❌ 不要使用 Geist、Inter、Roboto 等通用AI字体
2. ❌ 不要使用紫色渐变（典型的AI美学）
3. ❌ 不要过度设计动画，保持专业感
4. ❌ 不要违反设计系统的配色规范

---

## 📝 待办事项

- [ ] 添加暗色模式支持
- [ ] 创建更多组件（下拉框、模态框等）
- [ ] 添加响应式断点优化
- [ ] 创建 Storybook 展示所有组件

---

**创建时间**: 2026-02-03
**维护者**: Claude Code + frontend-design skill
