import * as fs from 'fs';

const filledIds = new Set([
  6709,6710,6711,6712,6714,6715,6716,6717,6718,6720,
  6786,6787,6788,6805,6806,6807,6810,6811,6812,6814,
  6815,6816,6817,6819,6821,6822,6823,6824,6825,6826,
  6830,6831,6832,6834,6838,6840,6845,6848,6852,6854,
  6856,6857,6859,6860,6947,7004,7006,7007,7009,7025,
  7039,7040,7042,7043,7044,7045,7046,7051,7062,7073,
  7105,7127,7189,7206,7212,7267,7273,7333,7334,7335,
  7336,7338,7339,7340,7341,7342,7344,7346,7432,7433,
  7436,7437,7443,7479,7480,7481,7537,7628,7629,7630,
  7631,7632,7633,7634,7635,7636,7637,7638,7639,7640,
  7641,7812,7813
]);

const src = 'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026司法执法监督\\生成文档\\26042801-空法规排查清单v1.0.md';
const content = fs.readFileSync(src, 'utf8');
const lines = content.split('\n');
const out: string[] = [];

let markedCount = 0;

for (const line of lines) {
  const m = line.match(/^\|\s*(\d+)\s*\|/);
  if (m) {
    const id = parseInt(m[1]);
    if (filledIds.has(id)) {
      if (line.includes('✅')) {
        out.push(line);
      } else {
        const parts = line.split('|');
        // Replace the last non-empty cell (处理 column)
        for (let i = parts.length - 1; i >= 0; i--) {
          if (parts[i].trim() === '' && i === parts.length - 1) continue;
          if (parts[i].trim() === '') {
            parts[i] = ' ✅  ';
            break;
          }
          break;
        }
        out.push(parts.join('|'));
        markedCount++;
      }
      continue;
    }
  }
  out.push(line);
}

// Update header
const result = out.join('\n')
  .replace('# 空法规排查清单 v1.0', '# 空法规排查清单 v1.1')
  .replace(
    '| 已导入（本次批量） | 25 部 | 已完成 |\n| 有源文件但源文件无正文 | 116 部 | 需从北大法宝等外部源获取全文 |\n| 无匹配源文件 | 153 部 | 需从北大法宝等外部源获取全文 |\n| **合计空法规** | **279 部** | — |',
    '| 已导入（.md 批量 + .docx/.doc 批量 + 手动） | 128 部 | ✅ 已完成 |\n| 有源文件但源文件无正文 | 116 部 | 需从北大法宝等外部源获取全文 |\n| 无匹配源文件（仍为空） | 50 部 | 需从北大法宝等外部源获取全文 |\n| 无匹配源文件（已跳过，无条款结构） | 34 部 | 立法解释/短文本，需手动处理 |\n| **合计仍为空** | **176 部** | — |'
  );

const dest = 'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026司法执法监督\\生成文档\\26042801-空法规排查清单v1.1.md';
fs.writeFileSync(dest, result, 'utf8');
console.log('Marked ' + markedCount + ' new rows with ✅');
console.log('Written to: ' + dest);
