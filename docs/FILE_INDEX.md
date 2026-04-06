# 文件索引总入口

> [!tip] AI Agent 首次接手项目时必读
> 本索引提供了项目文件的整体结构和快速定位指南

---

## 🎯 快速导航

### 核心配置
- `CLAUDE.md` - AI配置和工作指南（**优先阅读**）

### 版本信息
- 当前版本：**v1.8.0** (2026-03-29)
- 最近更新：管理后台优化、移动端适配、分页

### 快速了解项目
1. 阅读 `README.md` - 项目概述
2. 阅读 `docs/CHANGELOG.md` - 版本历史
3. 阅读 `docs/STATUS.md` - 项目状态

---

## 📐 项目结构规范（AI Agent 必须遵守）

> [!warning] 重要规范
> 本章节定义了项目的标准目录结构和文件创建规则。**所有 AI Agent 在创建新文件前必须遵守本规范**。

### 标准目录结构

```
market-law-search/
├── src/
│   └── lib/              # ✅ 所有工具函数统一放这里
│       ├── db.ts
│       ├── category-config.ts
│       ├── level-utils.ts
│       └── [新工具文件]   # 新增工具必须放在这里
├── app/                  # Next.js 页面和组件
│   ├── admin/           # 管理后台
│   │   └── utils/       # 仅限 admin 专用工具
│   ├── components/      # 共享组件
│   └── ...
├── scripts/             # 工具脚本（分类存放）
│   ├── migrations/     # 数据迁移脚本
│   ├── backups/        # 备份脚本
│   └── archive/        # 归档的临时脚本
├── prisma/             # 数据库
├── docs/               # 文档
└── [根目录不放置 .js/.ts 文件]
```

### ❌ 禁止的目录结构

- ❌ 根目录 `lib/` → 必须使用 `src/lib/`
- ❌ `app/lib/` → 必须使用 `src/lib/`
- ❌ 根目录 `*.js/*.ts` → 脚本必须放在 `scripts/`

### 文件创建规则

| 文件类型 | 位置 | 示例 |
|---------|------|------|
| 工具函数 | `src/lib/[name].ts` | `src/lib/search-utils.ts` |
| React 组件 | `components/[ComponentName].tsx` | `components/SiteHeader.tsx` |
| 页面 | `app/[route]/page.tsx` | `app/admin/laws/page.tsx` |
| 临时脚本 | `scripts/[category]/[name].ts`（用完即删） | `scripts/check-db.js` |
| 数据迁移 | `scripts/migrations/[name].ts`（保留） | `scripts/migrations/migrate-levels.ts` |
| 备份脚本 | `scripts/backups/[name].ts`（保留） | `scripts/backups/backup-violations.ts` |
| 配置文件 | `src/lib/config-[name].ts` | `src/lib/category-config.ts` |

### 临时脚本命名规范（便于识别和清理）

- ✅ `migrate-*.ts` - 迁移脚本（保留）
- ✅ `backup-*.ts` - 备份脚本（保留）
- ✅ `regenerate-*.ts` - 重新生成脚本（保留）
- ⚠️ `check-*.ts` - 检查脚本（用完移到 `scripts/archive/`）
- ⚠️ `test-*.ts` - 测试脚本（用完移到 `scripts/archive/`）
- ⚠️ `debug-*.ts` - 调试脚本（用完移到 `scripts/archive/`）
- ⚠️ `fix-*.ts` - 临时修复脚本（用完移到 `scripts/archive/`）
- ⚠️ `delete-*.ts` - 删除脚本（用完立即删除）

---

## 📁 当前项目目录结构

```
market-law-search/
├── app/                          # Next.js 应用
│   ├── admin/                   # 管理后台
│   │   ├── actions.ts          # 后端API（重要）
│   │   ├── admin-styles.css    # 管理后台样式（含列宽拖拽CSS）
│   │   ├── laws/               # 法规管理
│   │   │   ├── page.tsx        # 列表页（服务端分页+筛选）
│   │   │   ├── LawTable.tsx    # 表格组件（内联编辑+分页+toast）
│   │   │   ├── ResizableHeader.tsx # 可拖拽列宽表头组件
│   │   │   └── ExportButton.tsx # JSON导出按钮
│   │   ├── utils/              # 工具函数
│   │   │   └── categoryCode.ts  # 编码映射工具
│   │   └── violations/         # 违法行为管理
│   │       ├── page.tsx         # 列表页
│   │       ├── new/             # 创建页
│   │       └── [id]/edit/       # 编辑页
│   ├── violations/              # 违法行为前端
│   │   ├── page.tsx            # 查询列表页
│   │   ├── [id]/page.tsx       # 详情页
│   │   └── ViolationList.tsx   # 查询组件
│   ├── law/[id]/               # 法规详情页
│   └── page.tsx                # 首页（含移动端适配）
├── components/                  # 共享组件
│   ├── SiteHeader.tsx          # 站点头部（响应式）
│   ├── MobileFilterPanel.tsx   # 移动端筛选面板（v1.8.0）
│   ├── LawSidebar.tsx          # 法规侧边栏筛选
│   └── ThemeToggle.tsx         # 主题切换
├── src/
│   ├── components/              # React 组件库
│   │   └── violations/          # 违法行为组件
│   │       ├── StatusBadge.tsx   # 状态标签
│   │       └── ViolationCard.tsx # 违法行为卡片
│   └── lib/                     # ✅ 工具函数库（统一位置）
│       ├── db.ts
│       ├── category-config.ts
│       ├── level-utils.ts
│       └── import/              # Excel 导入模块（v1.8.0）
│           ├── types.ts         # 类型定义
│           ├── excel-parser.ts  # Excel 读写
│           ├── article-parser.ts # 条款解析
│           ├── law-matcher.ts   # 法规匹配
│           └── data-validator.ts # 数据验证
├── prisma/                      # 数据库
│   └── schema.prisma            # 数据Schema
├── scripts/                     # 工具脚本（分类存放）
│   ├── migrations/             # 数据迁移脚本
│   ├── backups/                # 备份脚本和数据
│   ├── archive/                # 归档的临时脚本
│   ├── start-server.js         # 服务器启动脚本
│   ├── backup-violations.ts    # 数据备份
│   ├── regenerate-violation-codes.ts  # 重新生成编码
│   ├── diagnose-parsing.ts     # 诊断解析问题
│   ├── check-raw-text.ts       # 检查文本格式
│   ├── parse-violation-excel.ts # 违法行为Excel解析
│   └── import-*.ts             # 各种导入脚本
├── docs/                        # 项目文档
│   ├── FILE_INDEX.md            # 本文件（总入口）
│   ├── CHANGELOG.md             # 版本历史
│   ├── VIOLATION_FILE_INDEX.md  # 违法行为模块索引
│   └── ...其他文档
├── CLAUDE.md                    # AI配置文件
├── README.md                    # 项目说明
└── dev.db                       # 数据库文件
```

---

## 🗂️ 功能模块索引

### 1. 法规管理模块
**核心文件**：
- `app/admin/laws/page.tsx` - 法规列表页（服务端分页+筛选+排序）
- `app/admin/laws/LawTable.tsx` - 表格组件（内联编辑+分页+toast）
- `app/admin/laws/ResizableHeader.tsx` - 可拖拽列宽表头组件
- `app/law/[id]/page.tsx` - 法规详情页
- `app/admin/utils/contentParser.ts` - 法规解析器
- `components/MobileFilterPanel.tsx` - 移动端筛选面板（跨页面共享）

**相关文档**：
- `docs/PROJECT_ARCHITECTURE.md` - 架构说明
- `docs/DATA_DICTIONARY.md` - 数据字典

### 2. 违法行为模块 🆕
**核心文件**：
- `app/admin/violations/` - 管理页面
- `app/violations/` - 前端页面
- `app/admin/utils/categoryCode.ts` - 编码映射
- `lib/search-utils.ts` - 搜索优化

**详细索引**：`docs/VIOLATION_FILE_INDEX.md`

### 3. 搜索功能模块
**核心文件**：
- `app/page.tsx` - 首页搜索
- `app/admin/actions.ts` - 搜索API

**相关文档**：
- `docs/OPTIMIZATION.md` - 性能优化

---

## 🔧 工具和脚本

### 数据管理
- `scripts/backup-violations.ts` - 备份Violation数据
- `scripts/regenerate-violation-codes.ts` - 重新生成编码

### 诊断工具
- `scripts/diagnose-parsing.ts` - 诊断法规解析
- `scripts/check-raw-text.ts` - 检查文本格式

---

## 📄 重要文档索引

### 项目说明
- `README.md` - 项目概述和使用说明

### 配置文件
- `CLAUDE.md` - **AI Agent 必读**，工作指南
- `package.json` - 依赖和脚本
- `tsconfig.json` - TypeScript配置
- `next.config.js` - Next.js配置

### 技术文档
- `docs/PROJECT_ARCHITECTURE.md` - 项目架构
- `docs/DATA_DICTIONARY.md` - 数据字典
- `docs/QUICK_START.md` - 快速开始
- `docs/STATUS.md` - 项目状态

### 版本管理
- `docs/CHANGELOG.md` - **版本历史**，每次更新必看
- `docs/DOCUMENTATION_CHECKLIST.md` - 文档更新检查清单

### 问题排查
- `docs/TROUBLESHOOTING.md` - 常见问题解决

---

## 🔍 快速查找指南

### 查找页面路由
```bash
# 首页
app/page.tsx

# 法规详情
app/law/[id]/page.tsx

# 违法行为管理
app/admin/violations/page.tsx          # 列表
app/admin/violations/new/page.tsx      # 创建
app/admin/violations/[id]/edit/page.tsx # 编辑

# 违法行为查询
app/violations/page.tsx                  # 列表
app/violations/[id]/page.tsx           # 详情
```

### 查找后端API
**位置**：`app/admin/actions.ts`

**主要函数**：
- `createViolation()` - 创建违法行为
- `updateViolation()` - 更新违法行为
- `deleteViolation()` - 删除违法行为
- `searchLegalProvisions()` - 搜索法条
- `getAllViolations()` - 获取所有违法行为
- `getViolation()` - 获取单个违法行为

### 查找数据库模型
**位置**：`prisma/schema.prisma`

**主要模型**：
- `Law` - 法规
- `Article` - 条
- `Paragraph` - 款
- `Item` - 项
- `Violation` - 违法行为 🆕

---

## 🎯 AI Agent 工作流程

### 接手新任务时的必查步骤

1. **了解项目上下文**
   - [ ] 阅读 `CLAUDE.md`
   - [ ] 阅读 `docs/FILE_INDEX.md`（本文件）
   - [ ] 阅读 `docs/CHANGELOG.md` 最近版本

2. **查找相关文件**
   - [ ] 使用 `Grep` 搜索关键词
   - [ ] 使用 `Glob` 查找文件模式
   - [ ] 读取可能受影响的文件

3. **分析影响范围**
   - [ ] 检查数据模型变更的影响
   - [ ] 检查公共组件的使用
   - [ ] 列出需要同时修改的文件

4. **执行修改**
   - [ ] 按照CLAUDE.md的工作规范执行
   - [ ] 测试验证
   - [ ] 更新相关文档

### 常用搜索命令

```bash
# 搜索函数名
grep -r "function 函数名" app/

# 搜索数据库表名
grep -r "model 表名" prisma/

# 搜索组件
grep -r "组件名" app/

# 搜索所有引用
grep -r "import.*文件名" app/
```

---

## 📝 更新日志

- **v1.8.0** (2026-03-29) - 新增 ResizableHeader、MobileFilterPanel，更新 admin/laws 模块索引
- **v1.8.1** (2026-01-31) - 更新目录结构（添加 src/components/ 和 src/lib/import/）
- **v1.7.0** (2026-01-29) - 创建文件索引总入口
- **v1.6.11** (2026-01-28) - 法规组管理功能

---

**最后更新**：2026-03-29
**维护者**：2637182508@qq.com
