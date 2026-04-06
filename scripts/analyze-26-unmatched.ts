/**
 * 详细分析26条未匹配数据
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  console.log('详细分析26条未匹配数据\n');
  console.log('='.repeat(80));

  // 读取缺失法规Excel
  const filePath = "C:\\Users\\26371\\Desktop\\260128违法行为-缺失法规.xlsx";
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`原始文件: ${data.length}条\n`);

  // 读取最新的未匹配数据（重新解析一次）
  const { parseBasisField } = await import('../src/lib/import/article-parser');
  const { validateViolations } = await import('../src/lib/import/data-validator');

  // 解析所有数据
  const violations = [];
  for (const row of data as any[]) {
    const description = (row['违法行为'] || '').toString().trim();
    const violationBasisStr = (row['违法依据'] || '').toString().trim();
    const punishmentBasisStr = (row['处罚依据'] || '').toString().trim();
    const punishmentSuggestion = (row['处罚建议'] || '').toString().trim();

    const violationBasis = parseBasisField(violationBasisStr);
    const punishmentBasis = parseBasisField(punishmentBasisStr);

    const id = (row as any)['行号'] || Math.floor(Math.random() * 10000);

    violations.push({
      id,
      code: `N${id}`,
      description,
      shortName: description.substring(0, 12),
      violationBasis,
      punishmentBasis,
      discretionStandard: '',
      punishmentSuggestion,
    });
  }

  // 验证数据
  const validationResult = await validateViolations(violations);

  console.log('\n' + '='.repeat(80));
  console.log('未匹配数据统计');
  console.log('='.repeat(80));

  // 1. 缺失法规的数据
  if (validationResult.violationsWithMissingLaws.length > 0) {
    console.log('\n❌ 缺失法规的违法行为:\n');

    // 收集所有涉及的法规名称
    const missingLawsMap = new Map<string, number[]>();

    validationResult.violationsWithMissingLaws.forEach(item => {
      item.missingLawNames.forEach(lawName => {
        if (!missingLawsMap.has(lawName)) {
          missingLawsMap.set(lawName, []);
        }
        missingLawsMap.get(lawName)!.push(item.violation.id);
      });
    });

    console.log(`缺失的${missingLawsMap.size}部法规:\n`);
    let idx = 1;
    for (const [lawName, ids] of missingLawsMap.entries()) {
      console.log(`${idx}. ${lawName}`);
      console.log(`   涉及违法行为: ${ids.length}条`);
      console.log(`   行号: ${ids.join(', ')}`);
      idx++;
    }
  }

  // 2. 条款未匹配的数据
  if (validationResult.unmatchedArticles.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  条款未匹配的违法行为:\n');

    console.log(`共 ${validationResult.unmatchedArticles.length} 条\n`);

    // 统计涉及的法规
    const lawStats = new Map<string, { count: number; details: string[] }>();

    validationResult.unmatchedArticles.forEach(item => {
      item.unmatchedBasis.forEach(basis => {
        const lawName = basis.article.lawName;
        if (!lawStats.has(lawName)) {
          lawStats.set(lawName, { count: 0, details: [] });
        }
        const stat = lawStats.get(lawName)!;
        stat.count++;
        stat.details.push(`${basis.type}: ${basis.article.articleTitle} - ${basis.reason}`);
      });
    });

    console.log('涉及的法规统计:\n');
    for (const [lawName, stat] of lawStats) {
      console.log(`📋 ${lawName}`);
      console.log(`   未匹配数量: ${stat.count}条`);
      console.log(`   详情:\n`);

      // 显示前5条详情
      stat.details.slice(0, 5).forEach((detail, i) => {
        console.log(`     ${i + 1}. ${detail}`);
      });
      console.log();
    }

    // 显示具体的违法行为列表
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 条款未匹配的违法行为列表:\n');

    validationResult.unmatchedArticles.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.violation.description}`);

      // 显示未匹配的依据
      item.unmatchedBasis.forEach(basis => {
        console.log(`   [${basis.type}] ${basis.article.lawName} - ${basis.article.articleTitle}`);
        console.log(`   原因: ${basis.reason}`);
      });
      console.log();
    });
  }

  console.log('='.repeat(80));
}

main();
