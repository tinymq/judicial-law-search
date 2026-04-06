# 市场监管法规检索系统 - 数据字典

> 📅 更新时间：2026-01-31
> 📌 数据库：SQLite (dev.db)
> 📌 Prisma Schema: prisma/schema.prisma
> 📌 当前版本：v1.8.0

---

## 📊 数据库表结构

### 1. Law 表（法规表）

存储法规的基本信息、元数据和版本追踪信息。

#### 表名：`Law`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** - 法规的唯一标识符 |
| `title` | `String` | ✅ | - | **法规名称** - 如：中华人民共和国公司法、中华人民共和国食品安全法 |
| `issuingAuthority` | `String?` | ❌ | NULL | **制定机关** - 如：全国人大常委会、国务院、市场监管总局等 |
| `documentNumber` | `String?` | ❌ | NULL | **发文字号** - 如：主席令第66号、国令第748号 |
| `promulgationDate` | `DateTime?` | ❌ | NULL | **公布日期** - 法规公布的日期 |
| `effectiveDate` | `DateTime?` | ❌ | NULL | **施行日期** - 法规开始生效的日期 |
| `status` | `String?` | ❌ | 现行有效 | **时效性** - 现行有效、已被修改、已废止、尚未施行 |
| `level` | `String` | ✅ | 法律 | **效力位阶** - 法律、法律解释、有关法律问题和重大问题的决定、行政法规、部门规章、地方性法规、自治条例和单行条例、经济特区法规、海南自由贸易港法规、司法解释、规范性文件、地方政府规章、其他（13个） |
| `category` | `String` | ✅ | 综合监管 | **法规类别** - 综合监管、综合执法、反垄断与反不正当竞争、标准管理、产品质量、价格监管、计量监督、食品安全、网监与合同、特种设备、信用监管、商事登记、医疗器械、消费维权、药品监管、知识产权、广告监管、认证认可（17个） |
| `lawGroupId` | `String?` | ❌ | NULL | **法规组ID** - 用于关联同一法规的不同版本。基于标题的MD5哈希生成。例如：公司法的2023版和1993版会有相同的 lawGroupId |
| `createdAt` | `DateTime` | ✅ | 当前时间 | **创建时间** - 记录创建时间戳 |
| `updatedAt` | `DateTime` | ✅ | 自动更新 | **更新时间** - 记录最后修改时间戳 |

#### 索引

- 主键：`id`
- 自动索引：`createdAt`, `updatedAt`, `lawGroupId`

#### 关系

- 一对多：一个 Law 包含多个 Article（条款）
- 级联删除：删除 Law 时会自动删除其所有 Article

---

### 2. Article 表（条款表）

存储法规的条款基本信息（章、节、条），所有正文内容存储在 Paragraph 表中。

**重要变更（v1.6.0）**：删除了 `content` 字段，所有内容统一存储在 Paragraph 表中，实现完整的"条-款-项"三层结构。

#### 表名：`Article`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** - 条款的唯一标识符 |
| `lawId` | `Int` | ✅ | - | **所属法规ID** - 外键，关联到 Law 表的 id 字段 |
| `chapter` | `String?` | ❌ | NULL | **章信息** - 如：第一章 总则、第二章 管理体制等 |
| `section` | `String?` | ❌ | NULL | **节信息** - 如：第一节、第二节等（v1.5.0新增） |
| `title` | `String` | ✅ | - | **条款号** - 如：第一条、第二条、第三条等 |
| `order` | `Int` | ✅ | 0 | **排序序号** - 用于控制条款的显示顺序（1, 2, 3...） |

#### 索引

- 主键：`id`
- 外键索引：`lawId`
- 自动索引：`order`

#### 关系

- 多对一：多个 Article 属于一个 Law
- 一对多：一个 Article 包含多个 Paragraph（款）- **所有正文内容都存储在 Paragraph 中**
- 外键约束：`lawId` → `Law.id`
- 级联删除：删除 Law 时会自动删除其所有 Article；删除 Article 时会自动删除其所有 Paragraph

---

### 3. Paragraph 表（款表）

存储条款下的"款"，作为条款的可选子层级。

#### 表名：`Paragraph`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** - 款的唯一标识符 |
| `articleId` | `Int` | ✅ | - | **所属条款ID** - 外键，关联到 Article 表的 id 字段 |
| `number` | `Int` | ✅ | - | **款序号** - 如：1、2、3等 |
| `content` | `String?` | ❌ | NULL | **款内容** - 款的具体文字。可以是引导语（当有项时）或完整内容（无项时） |
| `order` | `Int` | ✅ | 0 | **排序序号** - 用于控制款的显示顺序（1, 2, 3...） |

#### 索引

- 主键：`id`
- 外键索引：`articleId`
- 自动索引：`order`

#### 关系

- 多对一：多个 Paragraph 属于一个 Article
- 一对多：一个 Paragraph 可以包含多个 Item（项）
- 外键约束：`articleId` → `Article.id`
- 级联删除：删除 Article 时会自动删除其所有 Paragraph；删除 Paragraph 时会自动删除其所有 Item

---

### 4. Item 表（项表）

存储款下的"项"，作为最小的内容存储单元。

#### 表名：`Item`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** - 项的唯一标识符 |
| `paragraphId` | `Int` | ✅ | - | **所属款ID** - 外键，关联到 Paragraph 表的 id 字段 |
| `number` | `String` | ✅ | - | **项编号** - 如：（一）、（二）、1.、2.等 |
| `content` | `String` | ✅ | - | **项内容** - 项的具体文字内容 |
| `order` | `Int` | ✅ | 0 | **排序序号** - 用于控制项的显示顺序（1, 2, 3...） |

#### 索引

- 主键：`id`
- 外键索引：`paragraphId`
- 自动索引：`order`

#### 关系

- 多对一：多个 Item 属于一个 Paragraph
- 外键约束：`paragraphId` → `Paragraph.id`
- 级联删除：删除 Paragraph 时会自动删除其所有 Item

---

### 5. Violation 表（违法行为表）

存储违法行为信息及其对应的违法依据和处罚依据。

**新增（v1.7.0）**：用于管理违法行为数据，关联到具体的法规条款。

#### 表名：`Violation`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** - 违法行为的唯一标识符 |
| `code` | `String` | ✅ | 自动生成 | **违法行为编码** - 如：N001, N002... |
| `description` | `String` | ✅ | - | **违法行为描述** - 具体的违法行为描述 |
| `sentencingGuidelines` | `String?` | ❌ | NULL | **裁量标准** - 自由裁量的标准和范围 |
| `punishmentSuggestion` | `String?` | ❌ | NULL | **处罚建议** - 建议的处罚措施和幅度 |
| `violationBasisLawId` | `Int?` | ❌ | NULL | **违法依据-法规ID** - 外键，关联到 Law 表的 id 字段 |
| `violationBasisArticleId` | `Int?` | ❌ | NULL | **违法依据-条款ID** - 外键，关联到 Article 表的 id 字段 |
| `violationBasisParagraphId` | `Int?` | ❌ | NULL | **违法依据-款ID** - 外键，关联到 Paragraph 表的 id 字段 |
| `violationBasisItemId` | `Int?` | ❌ | NULL | **违法依据-项ID** - 外键，关联到 Item 表的 id 字段 |
| `punishmentBasisLawId` | `Int?` | ❌ | NULL | **处罚依据-法规ID** - 外键，关联到 Law 表的 id 字段 |
| `punishmentBasisArticleId` | `Int?` | ❌ | NULL | **处罚依据-条款ID** - 外键，关联到 Article 表的 id 字段 |
| `punishmentBasisParagraphId` | `Int?` | ❌ | NULL | **处罚依据-款ID** - 外键，关联到 Paragraph 表的 id 字段 |
| `punishmentBasisItemId` | `Int?` | ❌ | NULL | **处罚依据-项ID** - 外键，关联到 Item 表的 id 字段 |
| `createdAt` | `DateTime` | ✅ | 当前时间 | **创建时间** - 记录创建时间戳 |
| `updatedAt` | `DateTime` | ✅ | 自动更新 | **更新时间** - 记录最后修改时间戳 |

#### 索引

- 主键：`id`
- 外键索引：`violationBasisLawId`, `punishmentBasisLawId`

#### 关系

- 多对一：多个 Violation 可以引用同一个 Law/Article/Paragraph/Item
- 外键约束：
  - `violationBasisLawId` → `Law.id`
  - `violationBasisArticleId` → `Article.id`
  - `violationBasisParagraphId` → `Paragraph.id`
  - `violationBasisItemId` → `Item.id`
  - `punishmentBasisLawId` → `Law.id`
  - `punishmentBasisArticleId` → `Article.id`
  - `punishmentBasisParagraphId` → `Paragraph.id`
  - `punishmentBasisItemId` → `Item.id`
- **注意**：Violation 不设置级联删除，以保护历史数据

#### 数据统计（v1.8.0）

- **总记录数**：1103 条
- **导入成功率**：91.9%
- **数据来源**：Excel 批量导入（260128违法行为.xlsx、260130违法行为-药品.xlsx）

---

## 🔗 表关系图

```
Law (法规表)
  ├── id (PK)
  ├── title (法规名称)
  ├── preamble (序言)
  ├── issuingAuthority (制定机关)
  ├── documentNumber (发文字号)
  ├── promulgationDate (公布日期)
  ├── effectiveDate (施行日期)
  ├── status (时效性)
  ├── level (效力位阶)
  ├── category (法规类别)
  ├── region (适用地区)
  ├── lawGroupId (法规组ID) ← 用于版本关联
  ├── createdAt (创建时间)
  ├── updatedAt (更新时间)
  └── Article[] (一对多)
       │
       └── Article (条款表)
            ├── id (PK)
            ├── lawId (FK) → Law.id
            ├── chapter (章)
            ├── section (节)
            ├── title (条款号)
            ├── content (条款正文) ← 可为null
            ├── order (排序)
            └── Paragraph[] (一对多，可选)
                 │
                 └── Paragraph (款表)
                      ├── id (PK)
                      ├── articleId (FK) → Article.id
                      ├── number (款序号)
                      ├── content (款内容) ← 可为null
                      ├── order (排序)
                      └── Item[] (一对多，可选)
                           │
                           └── Item (项表)
                                ├── id (PK)
                                ├── paragraphId (FK) → Paragraph.id
                                ├── number (项编号)
                                ├── content (项内容)
                                └── order (排序)

Violation (违法行为表) ← 多对一引用上述所有表
  ├── id (PK)
  ├── code (违法行为编码)
  ├── description (违法行为描述)
  ├── sentencingGuidelines (裁量标准)
  ├── punishmentSuggestion (处罚建议)
  ├── violationBasisLawId (FK) → Law.id
  ├── violationBasisArticleId (FK) → Article.id
  ├── violationBasisParagraphId (FK) → Paragraph.id
  ├── violationBasisItemId (FK) → Item.id
  ├── punishmentBasisLawId (FK) → Law.id
  ├── punishmentBasisArticleId (FK) → Article.id
  ├── punishmentBasisParagraphId (FK) → Paragraph.id
  ├── punishmentBasisItemId (FK) → Item.id
  ├── createdAt (创建时间)
  └── updatedAt (更新时间)
```

---

## 📝 字段使用说明

### Law.lawGroupId（法规组ID）

**用途：**
- 关联同一法规的不同版本
- 实现"本法变迁"功能

**生成规则：**
```javascript
// 基于法规标题生成 MD5 哈希
function generateLawGroupId(title) {
  const hash = crypto.createHash('md5').update(title).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

// 示例：
// "中华人民共和国公司法" → "LAW_97E7E14BB01A"
// "中华人民共和国食品安全法" → "LAW_36CC1406D1E5"
```

**使用场景：**
1. 创建新法规时，自动生成 lawGroupId
2. 如果关联到现有法规，使用现有法规的 lawGroupId
3. 查询历史版本时，通过 lawGroupId 查找所有版本

### Article.order（排序序号）

**用途：**
- 控制条款在法规详情页的显示顺序
- 保持条款的原始顺序

**示例：**
```
id=1, lawId=100, title="第一条", order=1  → 第一条
id=2, lawId=100, title="第二条", order=2  → 第二条
id=3, lawId=100, title="第三条", order=3  → 第三条
```

---

## 🔍 常用查询示例

### 查询法规及其所有条款

```sql
SELECT * FROM Law
WHERE id = 1;
```

```prisma
const law = await prisma.law.findUnique({
  where: { id: 1 },
  include: { articles: true }
});
```

### 查询同一法规的所有版本（本法变迁）

```sql
SELECT * FROM Law
WHERE lawGroupId = 'LAW_97E7E14BB01A'
ORDER BY
  CASE
    WHEN effectiveDate IS NOT NULL THEN effectiveDate
    ELSE promulgationDate
  END DESC;
```

```prisma
const laws = await prisma.law.findMany({
  where: { lawGroupId: 'LAW_97E7E14BB01A' },
  orderBy: [
    { effectiveDate: 'desc' },
    { promulgationDate: 'desc' }
  ]
});
```

### 搜索法规（按标题关键字）

```sql
SELECT * FROM Law
WHERE title LIKE '%公司法%';
```

```prisma
const laws = await prisma.law.findMany({
  where: {
    title: { contains: '公司法' }
  }
});
```

### 统计各时效性的法规数量

```sql
SELECT status, COUNT(*) as count
FROM Law
GROUP BY status;
```

---

## 📋 字段枚举值详细说明（v1.6.4 更新）

### status（时效性）- 4 个值

| 值 | 说明 | 使用场景 |
|---|------|----------|
| 现行有效 | 法规当前有效，正在实施 | 大部分法规 |
| 已被修改 | 法规已被后续法规修改或修订 | 如：公司法已被修正案修改 |
| 已废止 | 法规已被废止，不再有效 | 被新法替代的旧法 |
| 尚未施行 | 法规已公布但尚未到施行日期 | 未来生效的法规 |

**变更说明（v1.6.4）**：原"已被修订"已改名为"已被修改"，更准确描述法规状态。

---

### level（效力位阶）- 13 个值

**按法律效力从高到低排序**：

1. **法律** - 全国人大及其常委会制定的基本法律
2. **法律解释** - 全国人大常委会对法律的解释
3. **有关法律问题和重大问题的决定** - 全国人大常委会的决定
4. **行政法规** - 国务院制定的法规（条例、规定、办法）
5. **部门规章** - 国务院各部委制定的规章
6. **地方性法规** - 地方人大制定的法规
7. **自治条例和单行条例** - 民族自治地方的法规
8. **经济特区法规** - 经济特区的特殊法规
9. **海南自由贸易港法规** - 海南自贸港的特殊法规
10. **司法解释** - 最高法院、最高检察院的司法解释
11. **规范性文件** - 各级机关的规范性文件（通知、批复等）
12. **地方政府规章** - 地方政府制定的规章
13. **其他** - 兜底类别（已清空，不再使用）

**新增说明（v1.6.4）**：新增 5 个效力位阶选项，更全面覆盖中国法律体系。

---

### category（法规类别）- 17 个值

**按拼音排序**：

1. 反垄断与反不正当竞争
2. 标准管理
3. 产品质量
4. 价格监管
5. 计量监督
6. 食品安全
7. 网监与合同
8. 特种设备
9. 信用监管
10. 商事登记
11. 医疗器械
12. 消费维权
13. 药品监管
14. 知识产权
15. 综合监管（核心类别）
16. 综合执法（核心类别）
17. 广告监管
18. 认证认可

**变更说明（v1.6.4）**：
- 新增：产品质量、信用监管、标准管理、综合执法
- 合并：反垄断 + 反不正当竞争 → 反垄断与反不正当竞争
- 保留：网监与合同（原"网监"已合并）
- 保留：认证认可（为将来扩展准备）

---

## 📊 数据统计

**当前数据量（截至 2026-01-25）：**
- 法规总数：361 条
- 条款总数：数千条
- 数据库大小：约 15 MB
- 效力位阶类别：13 个（v1.6.4 扩展）
- 法规类别：17 个（v1.6.4 扩展）
- 时效性类别：4 个（v1.6.4 更新命名）

---

## 🔧 维护建议

### 数据完整性

1. **lawGroupId 维护**
   - 创建法规时自动生成
   - 关联现有法规时继承其 lawGroupId
   - 修改标题时不会自动更新 lawGroupId

2. **时间字段**
   - `promulgationDate`（公布日期）优先级高于 `effectiveDate`（施行日期）
   - 用于版本排序时，优先使用施行日期

3. **级联删除**
   - 删除法规会自动删除所有条款
   - 谨慎使用 DELETE 操作

### 性能优化

1. **索引**
   - `lawGroupId` 已自动索引，用于版本关联查询
   - `title` 字段可考虑添加全文搜索索引

2. **查询优化**
   - 使用 `select` 只查询需要的字段
   - 大量数据时使用 `take` 和 `skip` 分页

---

## 📌 版本历史

- **v1.0** (2026-01-18): 初始数据库设计（Law + Article 两层结构）
- **v1.6.4** (2026-01-25): 统一法规分类配置，扩展效力位阶到 13 个，法规类别到 17 个，时效性改名
- **v1.4** (2026-01-19): 添加 lawGroupId 字段，支持版本追踪
- **v1.5.0** (2026-01-21): 添加 Paragraph 和 Item 表，实现条-款-项四层结构
- **v1.5.1** (2026-01-22): 改进解析逻辑，支持引导语识别

---

**文档维护者：** Claude Sonnet 4.5
**最后更新：** 2026-01-25
