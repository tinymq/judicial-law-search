# 快速入门指南

> 📅 创建日期：2026-01-19
> 📌 适合：日常开发、快速查阅

---

## 🚀 快速开始

### 首次运行项目

```bash
# 1. 安装依赖
npm install

# 2. 导入数据（首次需要）
node prisma/import-json.js

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 首页：http://localhost:3000
# 管理后台：http://localhost:3000/admin/laws
```

---

## 📁 关键文件夹速查

| 文件夹 | 作用 | 是否在 Git 中 |
|--------|------|-------------|
| `app/` | 网页前端代码 | ✅ 是 |
| `src/lib/db.ts` | 数据库连接 | ✅ 是 |
| `src/lib/category-config.ts` | 统一分类配置（v1.6.4新增） | ✅ 是 |
| `prisma/schema.prisma` | 数据库结构定义 | ✅ 是 |
| `prisma/import-json.js` | 数据导入脚本 | ✅ 是 |
| `prisma/dev.db` | 数据库文件 | ❌ 否 |
| `laws/` | 原始 JSON 数据（358个，v1.4.6重命名） | ✅ 是 |
| `public/` | 静态资源 | ✅ 是 |
| `docs/` | 项目文档 | ✅ 是 |

---

## 🔥 常用命令

### 开发

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查
```

### 数据库

```bash
# 方式1：从 laws/ 导入（增量，不会清空现有数据）
node prisma/import-json.js

# 方式2：分步导入（Excel + MD 文件）
node scripts/step1-import-laws.js      # 步骤1：导入元数据
node scripts/step2-import-articles.js  # 步骤2：导入条款结构

# 查看数据库（可视化界面）
npx prisma studio

# 检查数据库状态
node scripts/check-db.js
```

### 导入导出

```bash
# 导出法规（完整结构化 JSON）
# 访问：http://localhost:3000/admin/laws
# 点击：导出 JSON 按钮
# 验证：node scripts/verify-export.js

# 批量导入（Excel + MD）
node scripts/step1-import-laws.js
node scripts/step2-import-articles.js
node scripts/verify-imported-laws.js

# 详细文档：docs/IMPORT_EXPORT_WORKFLOW.md
```

### Git

```bash
git status           # 查看状态
git add .            # 添加所有修改
git commit -m "描述"  # 提交
git push             # 推送到云端
git log --oneline    # 查看历史
```

---

## 📝 日常工作流程

### 新增法规（在线创建）

```bash
# 1. 启动服务器
npm run dev

# 2. 访问创建页面
http://localhost:3000/admin/create

# 3. 填写信息并粘贴全文
# 4. 点击"解析文本结构"
# 5. 预览并保存
```

### 批量导入法规（Excel + MD）

```bash
# 1. 准备数据文件
#    - lawsrawdata.xlsx（元数据）
#    - lawsrawdata/*.md（条款内容）

# 2. 分步导入
node scripts/step1-import-laws.js      # 导入元数据
node scripts/step2-import-articles.js  # 导入条款

# 3. 验证导入
node scripts/verify-imported-laws.js
```

### 导出法规（备份）

```bash
# 1. 访问管理后台
http://localhost:3000/admin/laws

# 2. 点击"导出 JSON"按钮
# 3. 验证导出
node scripts/verify-export.js

# 4. 导出文件保存在 laws-exported/ 目录
```

### 修改法规元数据

```bash
# 1. 启动服务器
npm run dev

# 2. 访问管理后台
http://localhost:3000/admin/laws

# 3. 直接在表格中修改，自动保存
```

---

## 🔄 数据备份与恢复

### 备份数据库

```bash
# 方式1：导出完整 JSON（推荐）
# 访问：http://localhost:3000/admin/laws
# 点击：导出 JSON
# 结果：laws-exported/ 目录

# 方式2：直接复制数据库文件
cp dev.db backups/dev.db.$(date +%Y%m%d)
```

### 恢复数据库

```bash
# 方式1：从导出的 JSON 恢复（需要编写导入脚本）
# 详细文档：docs/IMPORT_EXPORT_WORKFLOW.md

# 方式2：从备份文件恢复
cp backups/dev.db.20260125 dev.db
```

### 恢复代码版本

```bash
# 查看历史
git log --oneline

# 恢复到某个版本
git reset --hard <commit-id>

# 或者只查看某个文件的历史版本
git show <commit-id>:app/page.tsx
```

---

## 🐛 常见问题

### Q1: 数据库连接失败？

```bash
# 解决方法
npx prisma generate
rm -rf .next
npm run dev
```

### Q2: 修改代码后没反应？

```bash
# 硬刷新浏览器
Ctrl + Shift + R  (Windows)
Cmd + Shift + R   (Mac)

# 或重启服务器
npm run dev
```

### Q3: 找不到 dev.db？

```bash
# 重新生成数据库
node prisma/import-json.js
```

---

## 📚 更多文档

- **导入导出工作流：** [docs/IMPORT_EXPORT_WORKFLOW.md](./IMPORT_EXPORT_WORKFLOW.md) ⭐
- **完整架构文档：** [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)
- **数据字典：** [docs/DATA_DICTIONARY.md](./DATA_DICTIONARY.md)
- **解析规则：** [docs/PARSE_CONTENT_RULES.md](./PARSE_CONTENT_RULES.md)
- **项目状态：** [docs/STATUS.md](./STATUS.md)
- **项目 README：** [README.md](../README.md)

---

**最后更新：** 2026-01-25 (v1.6.6)
