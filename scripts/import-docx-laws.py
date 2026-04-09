# -*- coding: utf-8 -*-
"""
法规 docx 文件批量导入脚本

用法：
  python scripts/import-docx-laws.py                    # 试运行（不入库）
  python scripts/import-docx-laws.py --execute           # 正式导入
  python scripts/import-docx-laws.py --dry-run --limit 20  # 预览前20个
  python scripts/import-docx-laws.py --execute --subdir 法律  # 只导入法律目录
"""

import os
import re
import sys
import time
import shutil
import sqlite3
import argparse
from datetime import datetime, timezone

try:
    import docx
except ImportError:
    print("ERROR: python-docx not installed. Run: pip install python-docx")
    sys.exit(1)

# ============================================================
# 配置
# ============================================================

SOURCE_DIR = r"C:\Users\26371\Documents\EchoSyncMo\Mo Laws 法律法规"
DB_PATH = r"C:\Users\26371\Documents\MLocalCoding\judicial-law-search\dev.db"

SUBDIR_DEFAULTS = {
    "法律":    {"level": "法律",      "region": "全国"},
    "行政法规": {"level": "行政法规",  "region": "全国"},
    "江苏":    {"level": "地方性法规", "region": "江苏"},
}

# ============================================================
# 文件名解析
# ============================================================

def parse_filename(filename):
    """从文件名提取标题和日期。'中华人民共和国专利法_20201017.docx' -> ('中华人民共和国专利法', '2020-10-17')"""
    base = os.path.splitext(filename)[0]
    # 去掉尾部下划线（如 "南京市城乡规划条例_"）
    base = base.rstrip('_')
    m = re.match(r'^(.+?)_(\d{8})$', base)
    if m:
        title = m.group(1)
        d = m.group(2)
        date_str = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        return title, date_str
    return base, None

def date_to_unix_ms(date_str):
    """'2020-10-17' -> Unix毫秒时间戳"""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return None

# ============================================================
# 区域和位阶检测（移植自 import-md-laws.ts）
# ============================================================

PROVINCE_PATTERNS = [
    '北京', '上海', '天津', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '内蒙古', '广西', '西藏', '宁夏', '新疆',
]

SPECIAL_PREFIXES = [
    ('海南经济特区', '海南'), ('海南自由贸易港', '海南'),
    ('深圳经济特区', '广东'), ('厦门经济特区', '福建'),
    ('珠海经济特区', '广东'),
]

def detect_region(title):
    if not title:
        return '全国'
    for prefix, region in SPECIAL_PREFIXES:
        if title.startswith(prefix):
            return region
    for prov in PROVINCE_PATTERNS:
        if title.startswith(prov):
            return prov
    # 城市前缀
    city_m = re.match(r'^([\u4e00-\u9fa5]{2,4})市', title)
    if city_m:
        return city_m.group(1)
    # 自治州/县
    auto_m = re.match(r'^([\u4e00-\u9fa5]+(?:自治州|自治县))', title)
    if auto_m:
        return auto_m.group(1)
    return '全国'

def detect_level(title, issuing_authority=None):
    if title.startswith('中华人民共和国') and title.endswith('法'):
        return '法律'
    if re.match(r'^中华人民共和国.*法$', title):
        return '法律'
    if issuing_authority and '国务院' in issuing_authority and '条例' in title:
        return '行政法规'
    # 省级法规
    for p in ['省', '自治区', '直辖市']:
        if re.match(r'^[\u4e00-\u9fa5]+' + p, title):
            if any(kw in title for kw in ['条例', '规定', '办法']):
                return '地方性法规'
    # 市级法规
    if re.match(r'^[\u4e00-\u9fa5]{2,4}市', title):
        if any(kw in title for kw in ['条例', '规定', '办法']):
            return '地方性法规'
    if '自治条例' in title or '单行条例' in title:
        return '自治条例和单行条例'
    if issuing_authority and any(kw in issuing_authority for kw in ['部', '委员会', '总局', '署']):
        return '部门规章'
    return None  # 返回 None 表示用子目录默认值

def extract_issuing_authority(text):
    """从序言文本中提取制定机关"""
    if not text:
        return None
    m = re.search(r'([\u4e00-\u9fa5]+(?:常务委员会|人民代表大会|国务院|人民政府|委员会))', text)
    return m.group(1) if m else None

def extract_preamble_date(text):
    """从序言文本中提取最后一个日期（最新修订日期）"""
    if not text:
        return None
    dates = re.findall(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
    if dates:
        y, m, d = dates[-1]
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return None

# ============================================================
# 条款解析（移植自 import-md-laws.ts parseContent）
# ============================================================

CN_NUMS = '零一二三四五六七八九十百千'
NUM_PATTERN = f'[{CN_NUMS}0-9]+'

CHAPTER_RE = re.compile(rf'^\s*(第{NUM_PATTERN}章)\s+(.*)')
SECTION_RE = re.compile(rf'^\s*(第{NUM_PATTERN}节)\s+(.*)')
ARTICLE_RE = re.compile(rf'^\s*\**\s*(第{NUM_PATTERN}条)\s*\**\s*(.*)')
ITEM_RE1 = re.compile(r'^\s*([（(][一二三四五六七八九十]+[）)])\s*(.*)')
ITEM_RE2 = re.compile(r'^\s*(\d+[.、])\s*(.*)')
ITEM_RE3 = re.compile(r'^\s*([（(]\d+[）)])\s*(.*)')

def normalize_title(t):
    m = re.match(rf'^第({NUM_PATTERN})条$', t)
    return m.group(1) if m else t

def is_item(line):
    return bool(ITEM_RE1.match(line) or ITEM_RE2.match(line) or ITEM_RE3.match(line))

def match_item(line):
    return ITEM_RE1.match(line) or ITEM_RE2.match(line) or ITEM_RE3.match(line)

def parse_content(raw_content):
    """解析法规正文 -> (preamble, articles)"""
    preamble = ''
    text = raw_content

    # 提取序言
    trimmed = raw_content.lstrip()
    if trimmed and trimmed[0] in ('（', '('):
        close_char = '）' if trimmed[0] == '（' else ')'
        close_idx = raw_content.find(close_char)
        if close_idx != -1:
            preamble = raw_content[:close_idx + 1].strip()
            text = raw_content[close_idx + 1:].strip()

    lines = text.split('\n')
    articles = []
    current_chapter = ''
    current_section = ''
    current_article = None

    for line in lines:
        trim_line = line.strip()
        if not trim_line or re.match(r'^\s*\d+\s*$', trim_line):
            continue

        # 目录行跳过
        if trim_line in ('目　　录', '目录', '目  录'):
            continue

        chap_m = CHAPTER_RE.match(trim_line)
        if chap_m:
            if current_article:
                articles.append(current_article)
                current_article = None
            current_chapter = trim_line
            current_section = ''
            continue

        sec_m = SECTION_RE.match(trim_line)
        if sec_m:
            if current_article:
                articles.append(current_article)
                current_article = None
            current_section = trim_line
            continue

        art_m = ARTICLE_RE.match(trim_line)
        if art_m:
            if current_article:
                articles.append(current_article)
            current_article = {
                'title': normalize_title(art_m.group(1)),
                'chapter': current_chapter or None,
                'section': current_section or None,
                'paragraphs': [],
                '_first_line': art_m.group(2).strip() or '',
            }
            continue

        if current_article and is_item(trim_line):
            para = current_article['paragraphs'][-1] if current_article['paragraphs'] else None
            if not para:
                para = {
                    'number': 1,
                    'content': current_article['_first_line'] or None,
                    'items': [],
                    'order': 1,
                }
                current_article['paragraphs'].append(para)
                current_article['_first_line'] = ''
            im = match_item(trim_line)
            if im:
                para['items'].append({
                    'number': im.group(1),
                    'content': im.group(2),
                    'order': len(para['items']) + 1,
                })
            continue

        if current_article and trim_line:
            paras = current_article['paragraphs']
            if paras:
                last_para = paras[-1]
                if last_para['items']:
                    n = len(paras) + 1
                    paras.append({'number': n, 'content': trim_line, 'items': [], 'order': n})
                elif not last_para['content']:
                    last_para['content'] = trim_line
                else:
                    n = len(paras) + 1
                    paras.append({'number': n, 'content': trim_line, 'items': [], 'order': n})
            else:
                if current_article['_first_line']:
                    paras.append({'number': 1, 'content': current_article['_first_line'], 'items': [], 'order': 1})
                    paras.append({'number': 2, 'content': trim_line, 'items': [], 'order': 2})
                    current_article['_first_line'] = ''
                else:
                    current_article['_first_line'] = trim_line

    if current_article:
        articles.append(current_article)

    # 后处理
    for art in articles:
        if art['_first_line'] and not art['paragraphs']:
            art['paragraphs'].append({'number': 1, 'content': art['_first_line'], 'items': [], 'order': 1})
        del art['_first_line']

    return preamble, articles

# ============================================================
# Docx 读取
# ============================================================

def read_docx(filepath):
    """读取 docx 文件，返回 (title_from_content, full_text)"""
    doc = docx.Document(filepath)
    paragraphs = [p.text for p in doc.paragraphs]

    # 提取标题（第一个非空段落）
    title = ''
    title_idx = -1
    for i, p in enumerate(paragraphs):
        stripped = p.strip()
        if stripped and not stripped.startswith('目') and len(stripped) > 2:
            title = stripped
            title_idx = i
            break

    # 正文从标题之后开始
    body_lines = paragraphs[title_idx + 1:] if title_idx >= 0 else paragraphs
    full_text = '\n'.join(body_lines)

    return title, full_text

# ============================================================
# 数据库操作
# ============================================================

def import_law(conn, title, preamble, promulgation_date_ms, issuing_authority,
               level, region, articles):
    """导入一部法规到数据库"""
    cur = conn.cursor()
    now_ms = int(time.time() * 1000)

    cur.execute("""
        INSERT INTO Law (title, preamble, issuingAuthority, promulgationDate,
                         status, level, category, region, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        title,
        preamble or None,
        issuing_authority,
        promulgation_date_ms,
        '现行有效',
        level,
        '综合监管',
        region,
        now_ms,
        now_ms,
    ))
    law_id = cur.lastrowid

    for art_idx, art in enumerate(articles):
        cur.execute("""
            INSERT INTO Article (lawId, chapter, section, title, "order")
            VALUES (?, ?, ?, ?, ?)
        """, (
            law_id,
            art['chapter'],
            art['section'],
            art['title'],
            art_idx + 1,
        ))
        article_id = cur.lastrowid

        for para in art['paragraphs']:
            cur.execute("""
                INSERT INTO Paragraph (articleId, number, content, "order")
                VALUES (?, ?, ?, ?)
            """, (
                article_id,
                para['number'],
                para['content'],
                para['order'],
            ))
            paragraph_id = cur.lastrowid

            for item in para['items']:
                cur.execute("""
                    INSERT INTO Item (paragraphId, number, content, "order")
                    VALUES (?, ?, ?, ?)
                """, (
                    paragraph_id,
                    item['number'],
                    item['content'],
                    item['order'],
                ))

    return law_id

# ============================================================
# 主流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='法规 docx 批量导入')
    parser.add_argument('--execute', action='store_true', help='正式导入（默认试运行）')
    parser.add_argument('--dry-run', action='store_true', help='试运行（默认）')
    parser.add_argument('--limit', type=int, default=0, help='限制处理数量')
    parser.add_argument('--subdir', type=str, default='', help='只处理指定子目录（法律/行政法规/江苏）')
    args = parser.parse_args()

    execute = args.execute
    limit = args.limit

    print('=' * 60)
    print('法规 docx 批量导入工具')
    print('=' * 60)
    print(f"模式: {'正式导入' if execute else '试运行（不入库）'}")
    if limit:
        print(f"限制: {limit} 条")
    if args.subdir:
        print(f"子目录: {args.subdir}")
    print()

    # 备份数据库
    if execute:
        backup_path = DB_PATH + f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        print(f"备份数据库 → {os.path.basename(backup_path)}")
        shutil.copy2(DB_PATH, backup_path)

    # 连接数据库
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # 加载已有标题
    cur = conn.cursor()
    cur.execute("SELECT title FROM Law")
    existing_titles = set(row[0] for row in cur.fetchall())
    print(f"数据库已有: {len(existing_titles)} 部法规")

    # 收集文件
    all_files = []
    subdirs = [args.subdir] if args.subdir else list(SUBDIR_DEFAULTS.keys())

    for subdir in subdirs:
        dir_path = os.path.join(SOURCE_DIR, subdir)
        if not os.path.isdir(dir_path):
            print(f"警告: 目录不存在 {dir_path}")
            continue
        for f in sorted(os.listdir(dir_path)):
            if not f.endswith('.docx'):
                continue
            if ' (2)' in f or '(2)' in f:
                continue
            all_files.append((os.path.join(dir_path, f), f, subdir))

    print(f"找到 .docx 文件: {len(all_files)} 个")

    # 预匹配
    to_import = []
    skipped_existing = 0
    for filepath, filename, subdir in all_files:
        title, date_str = parse_filename(filename)
        if title in existing_titles:
            skipped_existing += 1
            continue
        # 包含匹配
        found = False
        for et in existing_titles:
            if title in et or et in title:
                found = True
                break
        if found:
            skipped_existing += 1
            continue
        to_import.append((filepath, filename, subdir, title, date_str))

    print(f"已存在跳过: {skipped_existing} 个")
    print(f"待导入: {len(to_import)} 个")

    if limit:
        to_import = to_import[:limit]
        print(f"限制处理: {len(to_import)} 个")
    print()

    # 导入
    imported = 0
    failed = 0
    errors = []
    stats_by_dir = {}
    stats_by_level = {}

    for i, (filepath, filename, subdir, title, file_date) in enumerate(to_import):
        try:
            # 读取 docx
            content_title, full_text = read_docx(filepath)

            # 解析正文
            preamble, articles = parse_content(full_text)

            # 从序言提取元数据
            issuing_authority = extract_issuing_authority(preamble)
            preamble_date = extract_preamble_date(preamble)

            # 日期优先用序言中的，其次用文件名中的
            date_str = preamble_date or file_date
            date_ms = date_to_unix_ms(date_str)

            # 推断 region 和 level
            defaults = SUBDIR_DEFAULTS.get(subdir, {"level": "地方性法规", "region": "全国"})
            region = detect_region(title)
            if region == '全国':
                region = defaults['region']

            detected_level = detect_level(title, issuing_authority)
            level = detected_level or defaults['level']

            # 统计
            stats_by_dir[subdir] = stats_by_dir.get(subdir, 0) + 1
            stats_by_level[level] = stats_by_level.get(level, 0) + 1

            total_paras = sum(len(a['paragraphs']) for a in articles)
            total_items = sum(sum(len(p['items']) for p in a['paragraphs']) for a in articles)

            if not execute:
                if i < 10 or i % 200 == 0:
                    print(f"[{i+1:4d}] {title}")
                    print(f"       {subdir} | {level} | {region} | {date_str or '无日期'}")
                    print(f"       {len(articles)}条 {total_paras}款 {total_items}项 | 序言{'有' if preamble else '无'}")
            else:
                try:
                    import_law(conn, title, preamble, date_ms, issuing_authority,
                               level, region, articles)
                    conn.commit()
                except Exception as db_err:
                    conn.rollback()
                    raise db_err

            imported += 1

            if (i + 1) % 100 == 0:
                print(f"进度: {i+1}/{len(to_import)} | 成功: {imported} | 失败: {failed}")

        except Exception as e:
            failed += 1
            err_msg = str(e)[:120]
            errors.append((filename, err_msg))
            if failed <= 5:
                print(f"[错误] {filename}: {err_msg}")

    # 汇总
    print()
    print('=' * 60)
    print('导入完成')
    print('=' * 60)
    print(f"  处理文件: {len(to_import)}")
    print(f"  成功: {imported}")
    print(f"  失败: {failed}")
    print(f"  模式: {'已入库' if execute else '试运行（未入库）'}")

    print(f"\n--- 按目录 ---")
    for d, c in sorted(stats_by_dir.items(), key=lambda x: -x[1]):
        print(f"  {d}: {c}")

    print(f"\n--- 按位阶 ---")
    for l, c in sorted(stats_by_level.items(), key=lambda x: -x[1]):
        print(f"  {l}: {c}")

    if errors:
        print(f"\n--- 错误（前20个）---")
        for fn, err in errors[:20]:
            print(f"  {fn}: {err}")

    if not execute:
        print('\n这是试运行，未写入数据库。添加 --execute 参数执行实际导入。')

    # 最终统计
    cur.execute("SELECT count(*) FROM Law")
    print(f"\n数据库法规总数: {cur.fetchone()[0]}")

    conn.close()

if __name__ == '__main__':
    main()
