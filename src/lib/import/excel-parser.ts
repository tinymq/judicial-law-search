/**
 * Excel解析器
 * 读取Excel文件并解析为结构化数据
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelRow, ParsedViolation } from './types';
import { parseExcelRow } from './article-parser';

/**
 * 确保目录存在
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取Excel文件
 */
export function readExcelFile(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: '', // 空单元格默认值
  });

  console.log(`读取Excel文件: ${filePath}`);
  console.log(`工作表: ${sheetName}`);
  console.log(`总行数: ${data.length}`);

  return data as any[];
}

/**
 * 解析Excel数据为违法行为列表
 */
export function parseExcelData(data: any[]): ParsedViolation[] {
  const violations: ParsedViolation[] = [];
  let errorCount = 0;

  for (const row of data) {
    const parsed = parseExcelRow(row);
    if (parsed) {
      violations.push(parsed);
    } else {
      errorCount++;
    }
  }

  console.log(`解析完成: ${violations.length} 条数据`);
  if (errorCount > 0) {
    console.warn(`跳过 ${errorCount} 条无效数据`);
  }

  return violations;
}

/**
 * 导出数据为JSON文件
 */
export function exportToJson(data: any, outputPath: string): void {
  ensureDir(path.dirname(outputPath));
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`已导出JSON: ${outputPath}`);
}

/**
 * 导出数据为Excel文件
 */
export function exportToExcel(data: any[], outputPath: string): void {
  ensureDir(path.dirname(outputPath));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, outputPath);
  console.log(`已导出Excel: ${outputPath}`);
}

/**
 * 导出缺失法规列表
 */
export function exportMissingLaws(
  missingLaws: Array<{
    lawName: string;
    violationsCount: number;
    violationIds: number[];
  }>,
  outputPath: string
): void {
  const data = missingLaws.map((item, idx) => ({
    序号: idx + 1,
    法规名称: item.lawName,
    涉及违法行为数量: item.violationsCount,
    违法行为序号列表: item.violationIds.join(', '),
  }));

  exportToExcel(data, outputPath);
}

/**
 * 导出含有缺失法规的违法行为列表
 */
export function exportViolationsWithMissingLaws(
  violations: Array<{
    violation: ParsedViolation;
    missingLawNames: string[];
  }>,
  outputPath: string
): void {
  const data = violations.map((item) => ({
    序号: item.violation.id,
    违法行为代码: item.violation.code,
    违法行为描述: item.violation.description,
    违法行为简称: item.violation.shortName,
    缺失法规: item.missingLawNames.join('; '),
    违法依据: item.violation.violationBasis.map((a) => a.lawName + a.articleTitle).join('; '),
    处罚依据: item.violation.punishmentBasis.map((a) => a.lawName + a.articleTitle).join('; '),
  }));

  exportToExcel(data, outputPath);
}

/**
 * 导出条款未匹配的违法行为列表
 */
export function exportUnmatchedArticles(
  violations: Array<{
    violation: ParsedViolation;
    unmatchedBasis: Array<{
      type: 'violation' | 'punishment';
      article: { lawName: string; articleTitle: string };
      reason: string;
    }>;
  }>,
  outputPath: string
): void {
  const data = violations.map((item) => {
    const unmatchedDetails = item.unmatchedBasis
      .map((b) => `[${b.type === 'violation' ? '违法依据' : '处罚依据'}] ${b.article.lawName}${b.article.articleTitle} - ${b.reason}`)
      .join('\n');

    return {
      序号: item.violation.id,
      违法行为代码: item.violation.code,
      违法行为描述: item.violation.description,
      未匹配条款详情: unmatchedDetails,
      违法依据数量: item.violation.violationBasis.length,
      处罚依据数量: item.violation.punishmentBasis.length,
      未匹配数量: item.unmatchedBasis.length,
    };
  });

  exportToExcel(data, outputPath);
}
