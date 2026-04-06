# 司法领域执法监督法规检索系统 - 项目架构文档

> 📅 创建日期：2026-01-19
> 📌 项目版本：v2.0.0
> 🔄 最后更新：2026-04-06

---

## 📋 项目概览

**项目名称**：司法领域执法监督法规检索系统 (Judicial Law Search)

**项目简介**：基于 Next.js 的司法领域执法监督法规检索系统，服务各省司法厅/局。支持法规全文搜索、行业分类筛选、执法事项目录管理。从 market-law-search v1.8.0 改造而来。

**核心功能**：
- ✅ 全文搜索：支持关键词搜索法规标题和正文
- ✅ 分类筛选：按行业、效力位阶、区域、年份、时效性筛选
- ✅ 法规详情：完整的法规条款展示，支持目录导航
- ✅ 在线管理：后台管理界面，支持元数据修改和新法规录入
- ✅ 行业分类：司法部标准 71 个行业，多对多关联
- ✅ 区域层级：省-市折叠展开浏览
- 🔲 执法事项目录：数据模型已就绪，UI 待实现

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.3 | React 全栈框架（App Router） |
| **React** | 19.2.3 | 前端 UI 库 |
| **TypeScript** | 5 (ES2018) | 类型安全 |
| **Prisma** | 5.22.0 | ORM 数据库工具 |
| **SQLite** | 3 | 轻量级数据库 |
| **Tailwind CSS** | 4 | CSS 框架 |
| **PM2** | Latest | 进程管理器（生产环境） |
| **Node.js** | 18+ | 运行时环境 |

---

## 📁 项目结构

```
judicial-law-search/
├── app/                    # Next.js 应用主目录
│   ├── page.tsx           # 首页：搜索界面
│   ├── layout.tsx         # 全局布局
│   ├── globals.css        # 全局样式
│   │
│   ├── law/[id]/          # 法规详情页路由
│   │   └── page.tsx       # 法规详情页面
│   │
│   └── admin/             # 管理后台
│       ├── actions.ts     # Server Actions
│       ├── create/page.tsx # 创建法规页面
│       └── laws/          # 法规管理
│           ├── page.tsx    # 法规列表页面
│           └── LawTable.tsx # 法规表格组件
│
├── prisma/                # 数据库相关
│   ├── schema.prisma      # 数据库结构定义
│   └── import-json.js     # 数据导入脚本
│
├── src/                   # 源代码目录
│   └── lib/               # 核心库文件
│       ├── db.ts          # 数据库连接模块
│       ├── category-config.ts  # 统一分类配置
│       ├── level-utils.ts      # 效力位阶工具函数
│       ├── region-config.ts    # 区域配置（省市县映射）(v2.0.0)
│       ├── industry-keywords.ts # 行业关键词配置 (v2.0.0)
│       └── law-grouping.ts     # 法规分组工具 (v2.0.0)
│
├── laws/                  # 原始法规 JSON 文件
│
├── public/                # 静态资源
│
├── docs/                  # 项目文档
│   ├── QUICK_START.md
│   ├── DATA_DICTIONARY.md
│   ├── PROJECT_ARCHITECTURE.md
│   ├── STATUS.md
│   ├── TROUBLESHOOTING.md
│   ├── CHANGELOG.md
│   └── DOCUMENTATION_CHECKLIST.md
│
├── scripts/               # 工具脚本（v1.8.0新增）
│   ├── migrations/        # 数据迁移脚本
│   ├── backups/           # 备份脚本
│   ├── archive/           # 归档的临时脚本（v1.8.1新增）
│   ├── start-server.js    # 服务启动脚本（v1.8.1移动）
│   └── *.ts               # 各种工具脚本
│
├── ecosystem.config.js    # PM2 配置文件（v1.8.0新增）
├── README.md              # 项目说明
├── CLAUDE.md              # AI 配置文件
└── dev.db                 # SQLite 数据库文件（~150 MB，6675部法规）
```

---

## 🗄️ 数据库结构

### 表结构（7 个表）

```
Industry (行业) ─┬─→ Law (法规) → Article (条) → Paragraph (款) → Item (项)
                 └─→ EnforcementItem (执法事项)

LawIndustry (法规-行业关联) ← 多对多
```

#### Industry（行业分类表）
- 司法部标准 71 个行业
- 关键字段：code, name, parentCode

#### Law（法规表）
- 存储法规基本信息
- 关键字段：title, status, level, region, industryId, lawGroupId

#### EnforcementItem（执法事项表）
- 各省执法事项目录
- 关键字段：name, category, province, industryId

#### Article（条表）→ Paragraph（款表）→ Item（项表）
- 法规正文的三层结构

#### LawIndustry（法规-行业关联表）
- 多对多关联，支持一部法规关联多个行业

### 数据统计
- 法规数量：6675 部
- 行业分类：71 个
- 法规-行业关联：4267 条

---

## 🔧 开发工作流

### 首次运行
```bash
npm install
npm run dev
```

### 常用命令
```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查

# 数据库
node prisma/import-json.js    # 导入法规
npx prisma studio              # 数据库管理界面
npx prisma db push            # 同步 schema

# Git
git add .
git commit -m "描述"
git push
```

### 版本发布流程
1. 更新代码
2. 运行 `npm run build` 验证
3. 更新 `CHANGELOG.md`
4. Git 提交
5. 创建 Git 标签

---

## 📊 性能优化策略

**当前状态**：
- 数据量：6675 部法规
- 性能：良好（首页 253ms，优化后 391KB）
- 已有索引：title, category, region, status, lawGroupId, industryId

**已完成优化（v2.0.0）**：
- 首页 `take: 200` 限制默认查询
- `select` 排除 preamble 大字段
- 年份统计改用原生 SQL
- 区域省-市层级聚合

**未来优化方向**：
- FTS5 全文搜索
- Redis 缓存（如需支持并发）

---

**最后更新**: 2026-04-06
**维护者**: 项目团队
