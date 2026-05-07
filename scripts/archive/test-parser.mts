import { parseLegalBasis, extractBasisLawNames } from "./src/lib/legal-basis-parser.js";

const text272 = '1《. 中华人民共和国工业产品生产许可证管理条例》（2005年...修订）\n第四十九条：取得...追究刑事责任。2.《危险化学品安全管理条例》（根据...修订）\n第九十三条：...依照《安全生产许可证条例》《中华人民共和国工业产品生产许可证管理条例》的规定处罚。';

console.log("=== #272 ===");
console.log("names:", extractBasisLawNames(text272));
const e272 = parseLegalBasis(text272);
for (const e of e272) console.log(`[${e.index}] ${e.lawName}`);

const text4356 = '中华人民共和国防治船舶污染内河水域环境管理规定(2022修正)\n第四十六条  违反本规定...\n船舶未按规定保存《油类记录簿》《货物记录簿》和《船舶垃圾记录簿》的...';

console.log("\n=== #4356 ===");
console.log("names:", extractBasisLawNames(text4356));
const e4356 = parseLegalBasis(text4356);
for (const e of e4356) console.log(`[${e.index}] ${e.lawName}`);
