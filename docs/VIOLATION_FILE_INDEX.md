# 违法行为模块 - 文件索引

> [!info] 用途
> 快速定位违法行为功能模块的所有文件位置

---

## 📁 目录结构

```
market-law-search/
├── app/
│   ├── admin/
│   │   ├── actions.ts                          # 后端API（修改）
│   │   ├── utils/
│   │   │   └── categoryCode.ts                 # 🆕 编码映射工具
│   │   └── violations/
│   │       ├── page.tsx                        # 🆕 管理列表页
│   │       ├── new/
│   │       │   └── page.tsx                    # 🆕 创建页面
│   │       ├── [id]/
│   │       │   └── edit/
│   │       │       └── page.tsx                # 🆕 编辑页面
│   │       ├── ViolationTable.tsx             # 🆕 列表表格组件
│   │       ├── NewViolationForm.tsx           # 🆕 创建表单组件
│   │       └── EditViolationForm.tsx          # 🆕 编辑表单组件
│   ├── violations/
│   │   ├── page.tsx                           # 🆕 查询列表页（修改）
│   │   ├── [id]/
│   │   │   └── page.tsx                        # 🆕 详情页（新建）
│   │   └── ViolationList.tsx                  # 🆕 查询列表组件
│   └── page.tsx                                # 首页（修改：优化查询卡片）
├── lib/
│   ├── import/                                 # 🆕 Excel批量导入工具模块
│   │   ├── types.ts                            # 类型定义
│   │   ├── excel-parser.ts                     # Excel读写工具
│   │   ├── article-parser.ts                   # 条款解析器（【法规】...【条款项】...【内容】）
│   │   ├── law-matcher.ts                      # 法规匹配算法（3-tier匹配）
│   │   └── data-validator.ts                   # 数据验证和分类
│   └── search-utils.ts                         # 🆕 搜索标准化工具
├── prisma/
│   └── schema.prisma                           # 数据库Schema（修改）
├── scripts/
│   ├── backup-violations.ts                   # 🆕 备份Violation数据
│   ├── regenerate-violation-codes.ts           # 🆕 重新生成编码
│   ├── diagnose-parsing.ts                     # 🆕 诊断法规解析
│   ├── check-raw-text.ts                       # 🆕 检查原始文本
│   ├── parse-violation-excel.ts               # 🆕 解析违法行为Excel（主入口）
│   ├── import-violations.ts                   # 🆕 批量导入违法行为到数据库
│   ├── parse-260128-excel.ts                  # 🆕 解析260128文件（专用）
│   ├── import-missing-laws-r.ts               # 🆕 导入缺失法规R文件
│   ├── import-drug-violations.ts               # 🆕 导入药品违法行为
│   ├── analyze-drug-excel.ts                   # 🆕 分析药品Excel数据
│   ├── check-levels.ts                         # 🆕 检查条款层级
│   ├── clean-violations.js                     # 🆕 清理违法行为数据
│   ├── count-violations.ts                     # 🆕 统计违法行为数量
│   ├── create-simple-test.js                   # 🆕 创建简单测试数据
│   ├── create-test-violations.js               # 🆕 创建测试违法行为
│   ├── debug-data.js                           # 🆕 调试数据
│   ├── delete-violation0.js                    # 🆕 删除测试数据
│   ├── diagnose-law-groups.ts                  # 🆕 诊断法规组
│   ├── migrate-lawgroups-exec.ts               # 🆕 执行法规组迁移
│   ├── migrate-lawgroups.ts                    # 🆕 迁移法规组
│   ├── migrate-levels.ts                       # 🆕 迁移层级数据
│   ├── quick-seed.js                           # 🆕 快速种子数据
│   ├── reseed-violation.js                     # 🆕 重新播种违法行为
│   ├── seed-violation.js                       # 🆕 播种违法行为数据
│   └── verify-v1.7.1.ts                        # 🆕 验证v1.7.1版本
└── VIOLATION_TEST_CASES.md                     # 🆕 测试用例文档
```

---

## 🧩 组件清单

### 1. ViolationTable.tsx
**位置**：`app/admin/violations/ViolationTable.tsx`
**功能**：违法行为管理列表表格
**用途**：展示违法行为列表，提供编辑和删除操作
**关键功能**：
- 列表展示（编码、描述、依据）
- 搜索和筛选
- 编辑按钮 → 跳转到编辑页
- 删除按钮 → 二次确认对话框

### 2. NewViolationForm.tsx
**位置**：`app/admin/violations/NewViolationForm.tsx`
**功能**：创建新违法行为表单
**用途**：创建新违法行为，级联选择法规和条款
**关键功能**：
- 违法行为描述输入
- 违法依据：级联选择（法规→条→款→项）
- 处罚依据：级联选择（法规→条→款→项）
- 裁量标准输入
- 处罚建议输入
- 实时搜索条款

### 3. EditViolationForm.tsx
**位置**：`app/admin/violations/EditViolationForm.tsx`
**功能**：编辑违法行为表单
**用途**：修改现有违法行为数据
**关键功能**：
- 加载现有数据
- 修改所有字段
- 编码自动更新（如果修改法规）
- 展示层级结构（所有款/项）
- 点击切换款/项

### 4. ViolationList.tsx
**位置**：`app/violations/ViolationList.tsx`
**功能**：违法行为查询列表
**用途**：前端展示，用户查询入口
**关键功能**：
- 卡片式展示
- 点击跳转详情页
- 快速浏览

---

## 🔧 工具和脚本

### 1. categoryCode.ts
**位置**：`app/admin/utils/categoryCode.ts`
**功能**：动态编码映射工具
**用途**：为法规category分配A-Z编码字母
**主要函数**：
```typescript
getCategoryCodeMapping()  // 获取category→字母映射
getCodeForCategory(cat)   // 获取指定category的编码
clearCategoryCodeCache() // 清除缓存
```

### 2. search-utils.ts
**位置**：`lib/search-utils.ts`
**功能**：搜索标准化工具
**用途**：支持多种格式的条款搜索
**主要函数**：
```typescript
normalizeArticleSearch(input)  // 标准化搜索输入
// 支持："第18条" → "十八"
//      "18条" → "十八"
//      "第十八条" → "十八"
```

### 3. backup-violations.ts
**位置**：`scripts/backup-violations.ts`
**功能**：备份Violation表数据
**用途**：数据安全，可恢复
**执行方式**：
```bash
npx tsx scripts/backup-violations.ts
```
**备份位置**：`backups/violations-YYYY-MM-DD.json`

### 4. regenerate-violation-codes.ts
**位置**：`scripts/regenerate-violation-codes.ts`
**功能**：重新生成所有违法行为的编码
**用途**：数据迁移、编码规则变更
**执行方式**：
```bash
npx tsx scripts/regenerate-violation-codes.ts
```
**注意**：⚠️ 会修改所有Violation的code字段

### 5. diagnose-parsing.ts
**位置**：`scripts/diagnose-parsing.ts`
**功能**：诊断法规解析问题
**用途**：检查条款结构是否正确
**执行方式**：
```bash
npx tsx scripts/diagnose-parsing.ts
```

### 6. check-raw-text.ts
**位置**：`scripts/check-raw-text.ts`
**功能**：检查原始文本格式
**用途**：诊断文本格式问题（如换行符）
**执行方式**：
```bash
npx tsx scripts/check-raw-text.ts
```

### 7. types.ts (Excel导入模块)
**位置**：`src/lib/import/types.ts`
**功能**：类型定义
**用途**：定义Excel导入相关数据结构
**主要类型**：
```typescript
ParsedArticle          # 解析后的条款结构
ParsedViolation        # 解析后的违法行为结构
ValidationResult       # 验证结果（可导入/缺失法规/未匹配条款）
ArticleMatchResult     # 条款匹配结果
```

### 8. excel-parser.ts (Excel导入模块)
**位置**：`src/lib/import/excel-parser.ts`
**功能**：Excel文件读写
**用途**：读取违法行为Excel，导出分类结果
**主要函数**：
```typescript
readViolationExcel(filePath)      # 读取Excel文件
exportToJson(data, outputPath)    # 导出为JSON
exportToExcel(data, outputPath)   # 导出为Excel
```

### 9. article-parser.ts (Excel导入模块)
**位置**：`src/lib/import/article-parser.ts`
**功能**：解析结构化文本
**用途**：解析【法规】...【条款项】...【内容】格式
**主要函数**：
```typescript
parseBasisField(field)            # 解析违法/处罚依据字段
parseArticleLevel(title)          # 解析条款层级（条-款-项）
parseViolationExcel(data)         # 解析完整Excel数据
```
**关键修复**：
- ✅ 支持解析"第五条第一项"格式（之前只支持"第（一）项"）
- ✅ 正确提取章、节、条、款、项层级
- ✅ 处理多部法规在一个字段中的情况

### 10. law-matcher.ts (Excel导入模块)
**位置**：`src/lib/import/law-matcher.ts`
**功能**：智能匹配法规和条款
**用途**：将解析结果与数据库匹配
**主要函数**：
```typescript
matchArticle(lawName, articleTitle)  # 匹配条款
```
**3-tier匹配算法**：
1. 精确匹配（直接查询）
2. 标准化匹配（去除《》、（）→()）
3. 模糊匹配（去除年份/状态后匹配）
**效果**：缺失法规从47部减少到7部（85%改进）

### 11. data-validator.ts (Excel导入模块)
**位置**：`src/lib/import/data-validator.ts`
**功能**：数据验证和分类
**用途**：将违法行为分为可导入/缺失法规/未匹配条款
**主要函数**：
```typescript
validateViolations(violations)  # 验证并分类
```
**输出统计**：
- 总数、可导入数量
- 缺失法规数量和名称
- 未匹配条款数量和详情
- 成功率

### 12. parse-violation-excel.ts
**位置**：`scripts/parse-violation-excel.ts`
**功能**：Excel解析主入口
**用途**：解析Excel并生成3个分类文件
**执行方式**：
```bash
npx tsx scripts/parse-violation-excel.ts
```
**输出文件**：
- `可导入数据.json` - 可直接导入的数据
- `缺失法规清单.json` - 缺失的法规列表
- `未匹配条款清单.json` - 未匹配条款的详情

### 13. import-violations.ts
**位置**：`scripts/import-violations.ts`
**功能**：批量导入违法行为到数据库
**用途**：将验证通过的数据导入数据库
**执行方式**：
```bash
npx tsx scripts/import-violations.ts
```
**关键功能**：
- 自动生成顺序编码（N001, N002...）
- 导入前获取最大编码号
- 每20条显示进度
- 显示成功/失败统计

### 14. import-drug-violations.ts
**位置**：`scripts/import-drug-violations.ts`
**功能**：导入药品违法行为
**用途**：专用导入药品相关违法行为Excel
**执行方式**：
```bash
npx tsx scripts/import-drug-violations.ts
```

### 15. analyze-drug-excel.ts
**位置**：`scripts/analyze-drug-excel.ts`
**功能**：分析药品Excel数据
**用途**：快速查看Excel结构和统计信息
**执行方式**：
```bash
npx tsx scripts/analyze-drug-excel.ts
```

---

## 📄 页面路由

### 管理后台

| 路由 | 页面 | 组件 |
|------|------|------|
| `/admin/violations` | 管理列表页 | `ViolationTable` |
| `/admin/violations/new` | 创建页面 | `NewViolationForm` |
| `/admin/violations/[id]/edit` | 编辑页面 | `EditViolationForm` |

### 前端用户

| 路由 | 页面 | 组件 |
|------|------|------|
| `/violations` | 查询列表页 | `ViolationList` |
| `/violations/[id]` | 详情页 | `app/violations/[id]/page.tsx` |

---

## 🔗 后端API

**位置**：`app/admin/actions.ts`

### 核心函数

| 函数名 | 功能 | 参数 |
|--------|------|------|
| `createViolation` | 创建违法行为 | Violation数据 |
| `updateViolation` | 更新违法行为 | id + 数据 |
| `deleteViolation` | 删除违法行为 | id |
| `getViolation` | 获取单个违法行为 | id |
| `getAllViolations` | 获取所有违法行为 | - |
| `searchLegalProvisions` | 搜索法条 | keyword + lawId |

---

## 📊 数据库Schema

**位置**：`prisma/schema.prisma`

### Violation表

**关键字段**：
- `code` - 违法行为编码（如A001）
- `categoryCode` - 类别编码字母（A-Z）
- `description` - 违法行为描述
- `violationBasisLawId` - 违法依据法规ID
- `violationBasisArticleId` - 违法依据条款ID
- `violationBasisParagraphId` - 违法依据款ID
- `violationBasisItemId` - 违法依据项ID
- `punishmentBasisLawId` - 处罚依据法规ID
- ...（处罚依据类似）
- `sentencingGuidelines` - 裁量标准
- `punishmentSuggestion` - 处罚建议

**索引**：
- `@@index([violationBasisLawId])`
- `@@index([punishmentBasisLawId])`
- `@@index([categoryCode])` 🆕

---

## 📝 相关文档

- [[功能：260129违法行为功能模块]] - 完整功能说明
- [[VIOLATION_TEST_CASES.md]] - 测试用例

---

**最后更新**：2026-01-29
**维护者**：2637182508@qq.com
