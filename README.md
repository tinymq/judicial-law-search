# 市场监管法规随手查

> 📚 基于 Next.js 的中国市场监管法规检索系统

## ✨ 功能特性

- 🔍 **全文搜索** - 支持关键词搜索法规标题和正文
- 📂 **分类筛选** - 按类别（17个专业领域）、效力位阶（13个层级）、年份筛选
- 📖 **法规详情** - 完整的法规条款展示，支持目录导航
- ⚙️ **在线管理** - 后台管理界面，支持元数据修改和新法规录入
- 📥 **数据导入** - 增量导入 JSON 格式的法规数据
- 📤 **数据导出** - 可导出数据库中的法规为 JSON 文件
- ⚙️ **统一配置** - 集中管理所有分类选项，维护更简单（v1.6.4）
- 🌐 **局域网部署** - 支持 PM2 后台运行，局域网内多设备访问（v1.8.0）

## 🚀 快速开始

### 首次运行

```bash
# 1. 安装依赖
npm install

# 2. 导入法规数据（361部法规）
node prisma/import-json.js

# 3. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 管理后台

访问 [http://localhost:3000/admin/laws](http://localhost:3000/admin/laws) 进行法规管理。

### 生产环境部署（v1.8.0）

```bash
# 1. 构建生产版本
npm run build

# 2. 启动生产服务器
npm run start

# 或使用 PM2 后台运行（推荐）
pm2 start ecosystem.config.js
pm2 save
```

访问 [http://192.168.1.16:3000](http://192.168.1.16:3000) 在局域网内访问（需配置防火墙）。

详细部署说明请查看 `配置防火墙指南.md` 和 `局域网部署完成报告.md`。

## 📚 项目文档

- 📖 [完整项目架构](./docs/PROJECT_ARCHITECTURE.md) - 详细的项目结构和技术说明
- 🚀 [快速入门指南](./docs/QUICK_START.md) - 常用命令和工作流程
- 📋 [项目状态](./docs/STATUS.md) - 当前进度和待办事项
- 📝 [更新日志](./docs/CHANGELOG.md) - 版本更新历史

## 📁 项目结构

```
market-law-search/
├── app/                  # Next.js 应用主目录
│   ├── page.tsx         # 首页搜索界面
│   ├── law/[id]/        # 法规详情页
│   └── admin/           # 管理后台
├── prisma/              # 数据库相关
│   ├── schema.prisma    # 数据库结构定义
│   └── import-json.js   # 数据导入脚本
├── src/lib/db.ts        # 数据库连接模块
├── lawsforgemini/       # 原始法规 JSON 文件（358个）
├── public/              # 静态资源
└── docs/                # 项目文档
```

详细的项目架构请查看 [完整项目架构文档](./docs/PROJECT_ARCHITECTURE.md)。

## 🔧 常用命令

### 开发

```bash
npm run dev          # 启动开发服务器
npm run dev:lan      # 启动开发服务器（局域网模式）
npm run build        # 构建生产版本
npm run lint         # 代码检查
```

### 法规关联回归检查

```bash
# 标题标准化与候选评分最小回归测试
npx tsx scripts/test-law-grouping.ts

# 历史 lawGroupId 巡检（检查疑似错组/异常分组）
npx tsx scripts/diagnose-lawgroup-anomalies.ts
```

说明：
- 修改法规自动关联、标题标准化、`lawGroupId` 生成规则后，至少运行一次这两条命令。
- 第一个脚本用于验证匹配规则没有回归。
- 第二个脚本用于扫描现有数据库中的历史分组异常。

### 生产环境

```bash
npm run start        # 启动生产服务器
npm run start:lan    # 启动生产服务器（局域网模式）

# PM2 进程管理
pm2 status           # 查看服务状态
pm2 logs             # 查看实时日志
pm2 restart all      # 重启所有服务
pm2 stop all         # 停止所有服务
pm2 resurrect        # 恢复已保存的服务
```

### 数据库

```bash
# 导入新法规（增量导入）
node prisma/import-json.js

# 查看数据库（可视化界面）
npx prisma studio

# 检查数据库状态
node check-db.js
```

### Git

```bash
git status           # 查看状态
git add .            # 添加所有修改
git commit -m "描述"  # 提交
git push             # 推送到云端
```

更多命令请查看 [快速入门指南](./docs/QUICK_START.md)。

## 🛠️ 技术栈

- **Next.js** 16.1.3 - React 全栈框架
- **TypeScript** 5 (ES2018) - 类型安全
- **Prisma** 5.22.0 - ORM 数据库工具
- **SQLite** - 轻量级数据库
- **Tailwind CSS** v4 - CSS 框架
- **PM2** - 进程管理器（生产环境）

## 📊 项目规模

- **法规数量：** 408 部
- **效力位阶：** 13 个层级
- **法规类别：** 17 个专业领域
- **代码总行数：** 15万+ 行
- **数据库大小：** 15 MB
- **配置文件：** 统一分类配置（v1.6.4）
- **部署方式：** PM2 后台运行 + 局域网访问（v1.8.0）

## 🔗 相关链接

- **GitHub 仓库：** https://github.com/tinymq/market-law-search
- **Next.js 文档：** https://nextjs.org/docs
- **Prisma 文档：** https://www.prisma.io/docs

## 📝 更新日志

### v1.8.0 (2026-01-30)

- 🌐 **局域网部署** - 支持 PM2 后台运行，局域网内多设备访问
- 🐛 **修复事务错误** - 修复生产环境 Prisma Client 未缓存导致的事务错误
- 🔧 **类型系统完善** - 修复所有 TypeScript 类型错误，升级到 ES2018
- 📦 **部署配置** - 新增 ecosystem.config.js、start-server.js、setup-firewall.bat
- 📚 **文档完善** - 新增防火墙配置指南和局域网部署报告

### v1.6.4 (2026-01-25)

- ✨ **统一配置管理** - 创建 `src/lib/category-config.ts` 集中管理所有分类选项
- ✨ **扩展效力位阶** - 从 8 个增加到 13 个层级
- ✨ **扩展法规类别** - 从 14 个增加到 17 个专业领域
- ✨ **时效性改名** - "已被修订" 改为 "已被修改"
- 🐛 **修复列表页 bug** - 管理后台列表页配置不一致问题
- 🐛 **数据质量提升** - 修正 136 条错误分类，合并重复类别
- 🐛 **修复标题错误** - 补齐"中华人民共和国"中的"人民"二字

### v1.0 (2026-01-19)

- ✅ 完成基础搜索功能
- ✅ 实现法规详情页
- ✅ 添加管理后台
- ✅ 支持增量导入和导出
- ✅ 移除数据库文件，优化 Git 仓库

---

**最后更新：** 2026-01-30
