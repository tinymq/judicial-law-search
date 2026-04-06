# 司法领域执法监督法规检索系统 - 数据字典

> 📅 更新时间：2026-04-06
> 📌 数据库：SQLite (dev.db)
> 📌 Prisma Schema: prisma/schema.prisma
> 📌 当前版本：v2.0.0

---

## 📊 数据库表结构

### 1. Industry 表（行业分类表）

存储司法部标准的 71 个一级行业分类。

#### 表名：`Industry`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `code` | `String` | ✅ | - | **行业编码** - 如 "30" = 市场监督管理（唯一） |
| `name` | `String` | ✅ | - | **行业名称** - 如 "市场监督管理" |
| `parentCode` | `String?` | ❌ | NULL | **父级编码** - null 表示一级行业 |
| `order` | `Int` | ✅ | 0 | **排序序号** |

#### 索引

- 主键：`id`
- 唯一索引：`code`
- 索引：`parentCode`

#### 关系

- 一对多：一个 Industry 可关联多个 Law（旧的直接关联，保留兼容）
- 多对多：通过 LawIndustry 关联表与 Law 关联
- 一对多：一个 Industry 可关联多个 EnforcementItem

---

### 2. Law 表（法规表）

存储法规的基本信息、元数据和版本追踪信息。

#### 表名：`Law`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `title` | `String` | ✅ | - | **法规名称** - 如：中华人民共和国公司法 |
| `issuingAuthority` | `String?` | ❌ | NULL | **制定机关** - 如：全国人大常委会、国务院等 |
| `documentNumber` | `String?` | ❌ | NULL | **发文字号** - 如：主席令第66号 |
| `preamble` | `String?` | ❌ | NULL | **序言/修订记录** - 括号内的修订历史说明 |
| `promulgationDate` | `DateTime?` | ❌ | NULL | **公布日期** |
| `effectiveDate` | `DateTime?` | ❌ | NULL | **施行日期** |
| `status` | `String?` | ❌ | 现行有效 | **时效性** - 现行有效、已被修改、已废止、尚未生效 |
| `level` | `String` | ✅ | 法律 | **效力位阶** - 见枚举值说明 |
| `category` | `String` | ✅ | 综合监管 | **法规类别** - 暂保留，后续由 industryId 替代 |
| `region` | `String?` | ❌ | NULL | **适用地区** - 如：全国、江苏、北京、南京等 |
| `industryId` | `Int?` | ❌ | NULL | **所属行业ID** - 外键关联 Industry 表（主行业） |
| `lawGroupId` | `String?` | ❌ | NULL | **法规组ID** - 关联同一法规的不同版本 |
| `createdAt` | `DateTime` | ✅ | 当前时间 | **创建时间** |
| `updatedAt` | `DateTime` | ✅ | 自动更新 | **更新时间** |

#### 索引

- 主键：`id`
- 索引：`title`, `category`, `region`, `status`, `lawGroupId`, `industryId`

#### 关系

- 一对多：Law → Article[]（级联删除）
- 多对一：Law → Industry（通过 industryId）
- 多对多：Law → Industry（通过 LawIndustry 关联表）

---

### 3. EnforcementItem 表（执法事项表）

存储各省执法事项目录，关联行业分类。

#### 表名：`EnforcementItem`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `sequenceNumber` | `Int` | ✅ | - | **序号** |
| `name` | `String` | ✅ | - | **执法事项名称** |
| `category` | `String` | ✅ | - | **执法类别** - 行政许可/行政强制/行政处罚/行政检查等 |
| `enforcementBody` | `String?` | ❌ | NULL | **执法主体（实施层级）** |
| `handlingDepartment` | `String?` | ❌ | NULL | **承办机构** |
| `legalBasisText` | `String?` | ❌ | NULL | **执法依据原文** |
| `remarks` | `String?` | ❌ | NULL | **备注** |
| `province` | `String` | ✅ | - | **省份代码** - 如 "320000" = 江苏 |
| `industryId` | `Int?` | ❌ | NULL | **所属行业ID** |
| `createdAt` | `DateTime` | ✅ | 当前时间 | **创建时间** |
| `updatedAt` | `DateTime` | ✅ | 自动更新 | **更新时间** |

#### 索引

- 主键：`id`
- 索引：`category`, `province`, `industryId`, `name`

#### 关系

- 多对一：EnforcementItem → Industry（通过 industryId）

---

### 4. Article 表（条表）

存储法规的条款基本信息（章、节、条），所有正文内容存储在 Paragraph 表中。

#### 表名：`Article`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `lawId` | `Int` | ✅ | - | **所属法规ID** - 外键关联 Law.id |
| `chapter` | `String?` | ❌ | NULL | **章信息** - 如：第一章 总则 |
| `section` | `String?` | ❌ | NULL | **节信息** - 如：第一节 一般规定 |
| `title` | `String` | ✅ | - | **条款号** - 存储纯中文数字，如"一"、"十二" |
| `order` | `Int` | ✅ | 0 | **排序序号** |

#### 索引

- 主键：`id`
- 索引：`lawId`, `title`

#### 关系

- 多对一：Article → Law（级联删除）
- 一对多：Article → Paragraph[]（级联删除）

---

### 5. Paragraph 表（款表）

存储条款下的"款"，作为条款的可选子层级。

#### 表名：`Paragraph`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `articleId` | `Int` | ✅ | - | **所属条款ID** - 外键关联 Article.id |
| `number` | `Int` | ✅ | - | **款序号** - 如：1、2、3 |
| `content` | `String?` | ❌ | NULL | **款内容** - 可为引导语（有项时）或完整内容 |
| `order` | `Int` | ✅ | 0 | **排序序号** |

#### 索引

- 主键：`id`
- 索引：`articleId`, `content`

#### 关系

- 多对一：Paragraph → Article（级联删除）
- 一对多：Paragraph → Item[]（级联删除）

---

### 6. Item 表（项表）

存储款下的"项"，作为最小的内容存储单元。

#### 表名：`Item`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `paragraphId` | `Int` | ✅ | - | **所属款ID** - 外键关联 Paragraph.id |
| `number` | `String` | ✅ | - | **项编号** - 如：（一）、（二）、1.、2. |
| `content` | `String` | ✅ | - | **项内容** |
| `order` | `Int` | ✅ | 0 | **排序序号** |

#### 索引

- 主键：`id`
- 索引：`paragraphId`, `content`

#### 关系

- 多对一：Item → Paragraph（级联删除）

---

### 7. LawIndustry 表（法规-行业关联表）

法规与行业的多对多关联，支持一部法规关联多个行业。

#### 表名：`LawIndustry`

#### 字段说明

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `Int` | ✅ | 自增 | **主键ID** |
| `lawId` | `Int` | ✅ | - | **法规ID** - 外键关联 Law.id |
| `industryId` | `Int` | ✅ | - | **行业ID** - 外键关联 Industry.id |
| `isPrimary` | `Boolean` | ✅ | false | **是否为主分类** |

#### 索引

- 主键：`id`
- 唯一约束：`[lawId, industryId]`
- 索引：`lawId`, `industryId`

#### 关系

- 多对一：LawIndustry → Law（级联删除）
- 多对一：LawIndustry → Industry

---

## 🔗 表关系图

```
Industry (行业分类表)
  ├── id (PK)
  ├── code (行业编码, UNIQUE)
  ├── name (行业名称)
  ├── parentCode (父级编码)
  ├── order (排序)
  ├── laws[] (旧一对多)
  ├── lawIndustries[] (多对多关联)
  └── enforcementItems[] (一对多)

Law (法规表)
  ├── id (PK)
  ├── title, preamble, issuingAuthority, documentNumber
  ├── promulgationDate, effectiveDate, status, level
  ├── category (旧分类，待废弃)
  ├── region (适用地区)
  ├── industryId (FK) → Industry.id (主行业)
  ├── lawGroupId (法规组ID)
  ├── articles[] → Article
  └── lawIndustries[] → LawIndustry

EnforcementItem (执法事项表)
  ├── id (PK)
  ├── sequenceNumber, name, category
  ├── enforcementBody, handlingDepartment, legalBasisText
  ├── province (省份代码)
  └── industryId (FK) → Industry.id

Article (条表)
  ├── id (PK)
  ├── lawId (FK) → Law.id
  ├── chapter, section, title, order
  └── paragraphs[] → Paragraph

Paragraph (款表)
  ├── id (PK)
  ├── articleId (FK) → Article.id
  ├── number, content, order
  └── items[] → Item

Item (项表)
  ├── id (PK)
  ├── paragraphId (FK) → Paragraph.id
  └── number, content, order

LawIndustry (法规-行业关联表)
  ├── id (PK)
  ├── lawId (FK) → Law.id
  ├── industryId (FK) → Industry.id
  └── isPrimary (是否主分类)
```

---

## 📝 字段使用说明

### Law.lawGroupId（法规组ID）

**用途**：关联同一法规的不同版本，实现"本法变迁"功能。

**生成规则（v2.0.0 修正）**：
```javascript
// 1. 清理标题：去除版本标记（年份后缀、修订/暂行/试行等修饰词）
function buildLawBaseTitle(title) {
  return title
    .replace(/[（(]\d{4}年?(修订|修正|公布|施行|修改)[）)]/g, '')
    .replace(/(暂行|试行)/g, '')
    .trim();
}

// 2. 基于清理后的标题生成 MD5 哈希
function generateLawGroupId(title) {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

// 示例：
// "中华人民共和国公司法" → "LAW_97E7E14BB01A"
// "中华人民共和国公司法(2023年修订)" → "LAW_97E7E14BB01A" (同一个ID)
```

### Law.region（适用地区）

**规范化规则（v2.0.0）**：
- 省级：使用标准简称，如"江苏"、"北京"、"广东"
- 市级：使用标准名称，如"南京"、"杭州"、"深圳"
- 全国性法规：值为 NULL 或"全国"
- 配置文件：`src/lib/region-config.ts`（PROVINCES、CITY_TO_PROVINCE、COUNTY_TO_PROVINCE 映射）

### Law.industryId 与 LawIndustry

- `Law.industryId`：主行业（一对一，用于简单查询）
- `LawIndustry`：多行业关联（多对多，一部法规可关联 1-3 个行业）
- 行业分类基于关键词匹配：标题 + 制定机关 → 行业关键词映射
- 配置文件：`src/lib/industry-keywords.ts`

---

## 📋 字段枚举值说明

### status（时效性）- 4 个值

| 值 | 说明 |
|---|------|
| 现行有效 | 法规当前有效，正在实施 |
| 已被修改 | 法规已被后续法规修改或修订 |
| 已废止 | 法规已被废止，不再有效 |
| 尚未生效 | 法规已公布但尚未到施行日期 |

### level（效力位阶）- 11 个值

按法律效力从高到低：法律 → 法律解释 → 有关法律问题和重大问题的决定 → 行政法规 → 部门规章 → 地方性法规 → 自治条例和单行条例 → 司法解释 → 地方政府规章 → 规范性文件 → 其他

---

## 📊 数据统计

**当前数据量（v2.0.0，2026-04-06）：**
- 法规总数：6675 部
- 行业分类：71 个一级行业
- 法规-行业关联：4267 条（64% 法规已分类）
- 效力位阶：11 个
- 时效性：4 个
- 数据库大小：~150 MB

---

## 📌 版本历史

- **v2.0.0** (2026-04-06): 项目改造为司法领域，新增 Industry/LawIndustry/EnforcementItem 表，删除 Violation 表，数据治理（lawGroupId/effectiveDate/区域/行业），法规扩容至 6675 部
- **v1.8.0** (2026-01-31): 添加 Violation 表、Excel 批量导入
- **v1.6.4** (2026-01-25): 统一分类配置，扩展效力位阶到 13 个
- **v1.6.0** (2026-01-23): 删除 Article.content，内容统一存储在 Paragraph
- **v1.5.0** (2026-01-21): 添加 Paragraph 和 Item 表，实现条-款-项结构
- **v1.4** (2026-01-19): 添加 lawGroupId 字段
- **v1.0** (2026-01-18): 初始数据库设计（Law + Article）

---

**文档维护者：** Claude Opus 4.6
**最后更新：** 2026-04-06
