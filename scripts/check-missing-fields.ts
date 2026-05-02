import path from 'path';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Fields on the Law model, categorized by nullability
// Required fields (String, not null in schema) - can only check for empty string
const REQUIRED_STRING_FIELDS = ['title', 'level', 'category', 'articleFormat'] as const;

// Optional string fields (String?) - can be null or empty
const OPTIONAL_STRING_FIELDS = [
  'issuingAuthority',
  'documentNumber',
  'preamble',
  'status',
  'region',
  'lawGroupId',
  'modifiesLawIds',
] as const;

// Optional non-string fields (DateTime?, Int?) - can only be null
const OPTIONAL_OTHER_FIELDS = [
  'promulgationDate',
  'effectiveDate',
  'industryId',
] as const;

const ALL_FIELDS = [
  ...REQUIRED_STRING_FIELDS,
  ...OPTIONAL_STRING_FIELDS,
  ...OPTIONAL_OTHER_FIELDS,
] as const;

const LEVELS = ['法律', '行政法规', '部门规章'] as const;

async function main() {
  const totalCount = await prisma.law.count();
  console.log(`\n===== Law 表字段完整性检查 =====`);
  console.log(`总记录数: ${totalCount}\n`);

  // Get counts per level
  const levelCounts: Record<string, number> = {};
  for (const level of LEVELS) {
    levelCounts[level] = await prisma.law.count({ where: { level } });
  }
  const otherCount = await prisma.law.count({
    where: { level: { notIn: [...LEVELS] } },
  });
  levelCounts['其他'] = otherCount;

  console.log(`按 level 分布:`);
  for (const [lvl, cnt] of Object.entries(levelCounts)) {
    console.log(`  ${lvl}: ${cnt}`);
  }
  console.log();

  // For each field, count missing (NULL or empty string) overall and by level
  type Row = {
    field: string;
    total_missing: number;
    total_pct: string;
    [key: string]: string | number;
  };
  const rows: Row[] = [];

  // Helper: count missing for a field, optionally filtered by level
  async function countMissing(
    field: string,
    levelFilter?: string
  ): Promise<number> {
    const isRequired = (REQUIRED_STRING_FIELDS as readonly string[]).includes(field);
    const isOptionalString = (OPTIONAL_STRING_FIELDS as readonly string[]).includes(field);

    const baseWhere: any = levelFilter ? { level: levelFilter } : {};

    if (isRequired) {
      // Required string: can only be empty string, not null
      return prisma.law.count({ where: { ...baseWhere, [field]: '' } });
    } else if (isOptionalString) {
      // Optional string: null OR empty
      const nullCount = await prisma.law.count({
        where: { ...baseWhere, [field]: null },
      });
      const emptyCount = await prisma.law.count({
        where: { ...baseWhere, [field]: '' },
      });
      return nullCount + emptyCount;
    } else {
      // Optional non-string (DateTime?, Int?): only null
      return prisma.law.count({ where: { ...baseWhere, [field]: null } });
    }
  }

  for (const field of ALL_FIELDS) {
    const row: Row = {
      field,
      total_missing: 0,
      total_pct: '',
    };

    row.total_missing = await countMissing(field);
    row.total_pct = ((row.total_missing / totalCount) * 100).toFixed(1) + '%';

    // By level
    for (const level of LEVELS) {
      const missing = await countMissing(field, level);
      const pct =
        levelCounts[level] > 0
          ? ((missing / levelCounts[level]) * 100).toFixed(1) + '%'
          : 'N/A';
      row[`${level}_missing`] = missing;
      row[`${level}_pct`] = pct;
    }

    rows.push(row);
  }

  // Print summary table
  const colWidth = 20;
  const fieldWidth = 22;

  // Header
  const header = [
    '字段'.padEnd(fieldWidth),
    `全部(${totalCount})`.padEnd(colWidth),
    ...LEVELS.map(
      (l) => `${l}(${levelCounts[l]})`.padEnd(colWidth)
    ),
  ].join(' | ');

  const separator = '-'.repeat(header.length);

  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const cells = [
      row.field.padEnd(fieldWidth),
      `${row.total_missing} (${row.total_pct})`.padEnd(colWidth),
      ...LEVELS.map((l) => {
        const m = row[`${l}_missing`];
        const p = row[`${l}_pct`];
        return `${m} (${p})`.padEnd(colWidth);
      }),
    ];
    console.log(cells.join(' | '));
  }
  console.log(separator);

  // Also print fields with 0% missing
  console.log(`\n完全填充的字段 (0% 缺失):`);
  const complete = rows.filter((r) => r.total_missing === 0);
  if (complete.length === 0) {
    console.log('  (无)');
  } else {
    for (const r of complete) {
      console.log(`  - ${r.field}`);
    }
  }

  // Fields with >50% missing
  console.log(`\n高缺失字段 (>50% 缺失):`);
  const highMissing = rows.filter(
    (r) => r.total_missing / totalCount > 0.5
  );
  if (highMissing.length === 0) {
    console.log('  (无)');
  } else {
    for (const r of highMissing) {
      console.log(`  - ${r.field}: ${r.total_missing} / ${totalCount} (${r.total_pct})`);
    }
  }

  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
