import assert from 'node:assert/strict';
import {
  buildLawBaseTitle,
  findRelatedLawCandidates,
  generateLawGroupId,
  normalizeLawTitle,
  type LawCandidate,
} from '../src/lib/law-grouping';

function runNormalizationTests() {
  assert.equal(
    normalizeLawTitle('《中华人民共和国公司法》（2023年修订）'),
    '中华人民共和国公司法(2023年修订)'
  );

  assert.equal(
    buildLawBaseTitle('中华人民共和国公司法（2023年修订）'),
    '中华人民共和国公司法'
  );

  assert.equal(
    buildLawBaseTitle('中华人民共和国公司法(2023年修正)'),
    '中华人民共和国公司法'
  );

  assert.equal(
    buildLawBaseTitle('市场监督管理执法监督暂行规定(2019年公布)'),
    '市场监督管理执法监督暂行规定'
  );

  assert.equal(
    generateLawGroupId('中华人民共和国公司法（2023年修订）'),
    generateLawGroupId('中华人民共和国公司法(2023年修正)')
  );
}

function runCandidateScoringTests() {
  const laws: LawCandidate[] = [
    {
      id: 1,
      title: '中华人民共和国公司法(2018年修正)',
      lawGroupId: 'LAW_A',
      effectiveDate: new Date('2018-10-26'),
      promulgationDate: new Date('2018-10-26'),
      status: '已被修改',
      level: '法律',
    },
    {
      id: 2,
      title: '中华人民共和国公司法(2023年修订)',
      lawGroupId: 'LAW_A',
      effectiveDate: new Date('2024-07-01'),
      promulgationDate: new Date('2023-12-29'),
      status: '现行有效',
      level: '法律',
    },
    {
      id: 3,
      title: '中华人民共和国食品安全法(2021年修正)',
      lawGroupId: 'LAW_B',
      effectiveDate: new Date('2021-04-29'),
      promulgationDate: new Date('2021-04-29'),
      status: '现行有效',
      level: '法律',
    },
  ];

  const result = findRelatedLawCandidates('中华人民共和国公司法（2023年修订）', laws);
  assert.ok(result.recommended, '应返回推荐候选');
  assert.equal(result.recommended?.id, 2);
  assert.equal(result.recommended?.shouldAutoSelect, true);
  assert.equal(result.recommended?.matchType, 'normalized_exact');

  const baseTitleResult = findRelatedLawCandidates('中华人民共和国公司法（2025年公布）', laws);
  assert.ok(baseTitleResult.recommended, '应返回去版本信息后的推荐候选');
  assert.equal(baseTitleResult.recommended?.lawGroupId, 'LAW_A');
  assert.equal(baseTitleResult.recommended?.matchType, 'base_title_exact');

  const fuzzyResult = findRelatedLawCandidates('公司法', laws);
  assert.ok(fuzzyResult.candidates.length > 0, '应返回模糊候选');
  assert.equal(fuzzyResult.candidates[0].lawGroupId, 'LAW_A');
  assert.equal(fuzzyResult.candidates.some(candidate => candidate.id === 3), false);

  const excludeResult = findRelatedLawCandidates(
    '中华人民共和国公司法(2023年修订)',
    laws,
    { excludeLawId: 2 }
  );
  assert.ok(excludeResult.recommended, '排除当前法规后仍应找到历史版本');
  assert.equal(excludeResult.recommended?.id, 1);
}

function main() {
  runNormalizationTests();
  runCandidateScoringTests();
  console.log('✅ law-grouping 最小回归测试通过');
}

main();
