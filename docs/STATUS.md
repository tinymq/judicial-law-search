# Project Status: Market Law Search (可为法规随手查)

**Last Updated:** 2026-03-29 (v1.8.0 - 管理后台优化、移动端适配、分页)
**Context:** This document serves as a checkpoint to restore context for development sessions.

## 1. Project Overview
*   **Name:** Market Law Search (可为法规随手查)
*   **Goal:** A fast, searchable database of Chinese market regulation laws (food safety, advertising, monopoly, etc.).
*   **Tech Stack:**
    *   **Framework:** Next.js 16.1.3 (App Router)
    *   **Language:** TypeScript 5 (ES2018 target)
    *   **Database:** SQLite (via Prisma 5.22.0 ORM)
    *   **Styling:** Tailwind CSS v4
    *   **Process Manager:** PM2 (for production background running)
    *   **Deployment:** Local network ready (0.0.0.0 binding + firewall configuration)

## 2. Current Implementation Status

### A. Data Layer
*   **Schema:**
    *   `Law` Table: Metadata (title, authority, dates, status, level, category, region, lawGroupId).
    *   `Article` Table: Structure (chapter, section, article number), linked to `Law`. **Content stored in Paragraph table (v1.6.0).**
    *   `Paragraph` Table: Optional sub-level under Article (款), can contain introductory text or items.
    *   `Item` Table: Smallest content unit (项), linked to `Paragraph`.
    *   **`Violation` Table: 违法行为数据** (v1.7.0). Metadata (code, description), links to Law/Article/Paragraph/Item for violation basis and punishment basis.
*   **Data:**
    *   Database `dev.db` is populated with **420 laws** (v1.8.0).
    *   **Violation table**: **1103 violation records** imported via Excel batch import (v1.8.0).
    *   Source data located in `laws/` (JSON format, renamed from `lawsforgemini/` in v1.4.6).
    *   **Import Strategy:** `prisma/import-json.js` now performs **SAFE INCREMENTAL IMPORT**. It skips laws that already exist in the DB (by title) to prevent overwriting manual edits.
*   **Configuration (v1.7.1):**
    *   `src/lib/category-config.ts`: **Unified configuration** for all category options (LEVEL_ORDER, LEVEL_OPTIONS, CATEGORY_OPTIONS, STATUS_OPTIONS, REGION_OPTIONS).
    *   All pages import from this single source to eliminate hardcoded duplicates.
    *   **11 levels** (整合后): 法律、法律解释、有关法律问题和重大问题的决定、行政法规、部门规章、地方性法规、自治条例和单行条例、司法解释、地方政府规章、规范性文件、其他
    *   **注**: 经济特区法规和海南自由贸易港法规已整合到"地方性法规" (2026-01-29)
    *   **17 categories**: 综合监管、综合执法、反垄断与反不正当竞争、标准管理、产品质量、价格监管、计量监督、食品安全、网监与合同、特种设备、信用监管、商事登记、医疗器械、消费维权、药品监管、知识产权、广告监管、认证认可
    *   **4 status values**: 现行有效、已被修改、已废止、尚未生效 (原"尚未施行"已改名)

### B. Frontend Features

#### 1. Public Search (`/`)
*   **Search:** Keyword search across titles and paragraph content (v1.6.0: searches Paragraph table).
*   **Filters:** 
    *   **Category:** Sidebar grouping (Food Safety, Advertising, etc.).
    *   **Year:** Sidebar grouping by promulgation year.
*   **UI:** Responsive layout with sticky sidebar and header. Mobile filter panel and search bar (v1.8.0).

#### 2. Law Detail (`/law/[id]`)
*   **Reading:** Full text display with clear visual hierarchy for chapters and articles.
*   **Navigation:** 
    *   **Table of Contents (TOC):** Auto-generated sidebar for chapter jumping.
    *   **Metadata:** Display of issuing authority, dates, status, etc.
    *   **Back to Top:** Floating button.

#### 3. Admin Panel (`/admin`)
*   **List (`/admin/laws`):**
    *   Table view of all regulations.
    *   **Inline Editing:** Support modifying Category, Level, Status, and Authority directly in the table. Toast feedback on save (v1.8.0).
    *   **Server-side Pagination:** Default 50 per page, supports 50/100/500 page sizes (v1.8.0).
    *   **Sort preserves filters:** Sorting no longer resets active filter parameters (v1.8.0).
    *   **Column Width Resizing:** Drag column borders to adjust width (50-500px range) (v1.6.5). Extracted ResizableHeader component (v1.8.0).
    *   **Sticky Headers:** All table headers fixed during vertical scroll (v1.6.5).
    *   **Fixed Columns:** Title column (left) and actions column (right) fixed during horizontal scroll (v1.6.5).
    *   **Bidirectional Scrolling:** Support both vertical and horizontal scrolling (v1.6.5).
    *   **Delete:** Remove individual laws.
    *   **Export JSON:** Complete structured export with all metadata and article hierarchy (v1.6.6).
*   **Create (`/admin/create`):**
    *   **Text Parser:** Client-side parsing of raw text (copy-paste) into structured Chapters/Articles/Paragraphs/Items.
    *   **Preview:** Real-time preview of parsed articles before submission.
    *   **Quick Import:** Parse metadata from formatted text (v1.4.3).
    *   **Auto Region Detection:** Automatically detect region from law title (prefix/bracket matching) (v1.6.5).
    *   **Auto-extract Revision History:** Automatically extract revision record from opening brackets (v1.6.5).
    *   **Year Marker Enhancement:** Auto-convert (YYYY修订) to (YYYY年修订) format (v1.6.5).
    *   **Auto-update Related Laws:** When creating new law linked to existing group, auto-update old versions to "已被修改" (v1.6.5).
    *   **Save Button on Preamble:** Added save button above revision record field (v1.6.5).
    *   **Redirect after Save:** Auto-redirect to law detail page after creation (v1.6.5).
*   **Edit (`/admin/edit/[id]`):**
    *   **Full Text Editing:** Edit law metadata and full content (v1.3).
    *   **Re-parsing:** Support re-parsing text structure.
    *   **UI Optimization:** Reordered fields (Full Text → Parse Button → Revision Record) (v1.6.5).
    *   **Redirect after Save:** Auto-redirect to law detail page after update (v1.6.5).

#### 4. Violation Module (`/violations`) (v1.7.0)
*   **Public Search (`/violations`)**:
    *   **Search:** Keyword search across violation descriptions.
    *   **Card Display:** Compact card layout with quick info preview.
    *   **Detail Link:** Click to view full violation details.
*   **Violation Detail (`/violations/[id]`)**:
    *   **Hierarchy Display:** Shows violation basis and punishment basis with full article hierarchy (Law → Article → Paragraph → Item).
    *   **Formatting:** Proper Chinese numbering conversion and markdown rendering.
*   **Admin Panel (`/admin/violations`)**:
    *   **List View:** Table with code, description, basis preview.
    *   **Create (`/admin/violations/new`)**: Dynamic code generation, cascade selection for law/article/paragraph/item.
    *   **Edit (`/admin/violations/[id]/edit`)**: Full edit capability with real-time article hierarchy display.
    *   **Inline Actions:** Edit and delete buttons directly in table.
*   **Excel Batch Import (v1.8.0)**:
    *   **Parsing Engine:** `src/lib/import/` modules parse structured format 【法规】...【条款项】...【内容】.
    *   **Smart Matching:** 3-tier matching algorithm (exact → normalized → fuzzy) with 85% improvement.
    *   **Validation:** Classifies data into importable, missing laws, unmatched articles.
    *   **Success Rate:** 1103/1201 records imported (91.9% success rate).
    *   **Tools:** `scripts/parse-violation-excel.ts`, `scripts/import-violations.ts`.

## 3. Key File Structure
*   **Configuration** (v1.6.4):
    *   `src/lib/category-config.ts` - **Unified Configuration**: All category options (single source of truth).
    *   `src/lib/level-utils.ts` - **Utility Functions**: Level sorting functions, imports from category-config.
    *   `src/lib/search-utils.ts` - **Search Standardization**: Article title normalization for search (v1.7.0).
*   **Excel Import Modules (v1.8.0)**:
    *   `src/lib/import/types.ts` - **Type Definitions**: ParsedArticle, ParsedViolation, ValidationResult.
    *   `src/lib/import/excel-parser.ts` - **Excel I/O**: Read/write Excel files.
    *   `src/lib/import/article-parser.ts` - **Parser**: Parse 【法规】...【条款项】...【内容】 format.
    *   `src/lib/import/law-matcher.ts` - **Matcher**: 3-tier matching algorithm for laws and articles.
    *   `src/lib/import/data-validator.ts` - **Validator**: Classify data into importable/missing/unmatched.
*   **Pages**:
    *   `app/page.tsx` - **Home**: Main search logic and server-side filtering.
    *   `app/law/[id]/page.tsx` - **Detail**: Law rendering and TOC generation.
    *   `app/admin/create/page.tsx` - **Admin Create**: Input form + Regex-based text parser.
    *   `app/admin/laws/page.tsx` - **Admin List**: Law management table.
    *   `app/admin/laws/LawTable.tsx` - **Admin Table Component**: Table view with inline editing, pagination, toast (v1.8.0).
    *   `app/admin/laws/ResizableHeader.tsx` - **Resizable Column Header**: Extracted component for drag-to-resize columns (v1.8.0).
    *   `app/admin/laws/ExportButton.tsx` - **Admin Export**: Button component triggering JSON export.
    *   `components/MobileFilterPanel.tsx` - **Mobile Filter**: Collapsible filter panel for mobile screens (v1.8.0).
    *   `app/violations/page.tsx` - **Violation List**: Public search interface (v1.7.0).
    *   `app/violations/[id]/page.tsx` - **Violation Detail**: Full hierarchy display (v1.7.0).
    *   `app/admin/violations/page.tsx` - **Violation Admin**: Management table (v1.7.0).
    *   `app/admin/violations/new/page.tsx` - **Violation Create**: Form with cascade selection (v1.7.0).
    *   `app/admin/violations/[id]/edit/page.tsx` - **Violation Edit**: Edit form with hierarchy (v1.7.0).
*   **Database**:
    *   `prisma/schema.prisma` - **DB**: Data models.
    *   `prisma/import-json.js` - **Script**: Incremental JSON import logic.
*   **Scripts**:
    *   `scripts/fix-categories-and-status.js` - **Migration Script**: Category merging and status renaming (v1.6.4).
    *   `scripts/batch-update-levels.js` - **Migration Script**: Batch level classification (v1.6.4).
    *   `scripts/parse-violation-excel.ts` - **Excel Parser**: Parse violation Excel and classify (v1.8.0).
    *   `scripts/import-violations.ts` - **Batch Import**: Import violations to database (v1.8.0).
    *   `scripts/import-drug-violations.ts` - **Drug Import**: Import drug-related violations (v1.8.0).

## 4. Pending / Next Steps
*   **Data Quality:** Current 420 laws. Quality issues addressed in v1.6.4 (category merging, level classification, title fixes).
*   **Performance Optimization:** Currently 420 laws, server-side pagination added in v1.8.0. See Section 6 for strategy.
*   **Full Text Editing:** ✅ Supported in Admin (v1.3).
*   **Law History Tracking:** ✅ Implemented with lawGroupId (v1.4).
*   **Hierarchical Structure:** ✅ Implemented Article-Paragraph-Item structure (v1.5.0).
*   **Page Titles & SEO:** ✅ Dynamic page titles for all pages (v1.5.1).
*   **Parsing Improvements:** ✅ Introductory text recognition for items (v1.5.1).
*   **Unified Configuration:** ✅ Implemented centralized category config (v1.6.4).
*   **Category Expansion:** ✅ Expanded to 13 levels and 17 categories (v1.6.4).
*   **Data Quality:** ✅ Fixed 136 misclassified laws, merged duplicate categories (v1.6.4).
*   **Version Control:** ✅ Git remote configured (https://github.com/tinymq/market-law-search.git).
*   **Auto-extract Revision History:** ✅ Automatically extract from brackets (v1.6.5).
*   **Year Marker Enhancement:** ✅ Auto-convert (YYYY修订) to (YYYY年修订) (v1.6.5).
*   **Auto-update Related Laws:** ✅ Auto-update old versions when new law is linked (v1.6.5).
*   **UI Optimization:** ✅ Reordered fields and renamed "序言" to "修订记录" (v1.6.5).
*   **Table Enhancement:** ✅ Column width dragging, sticky headers, fixed columns, bidirectional scrolling (v1.6.5).
*   **Auto Region Detection:** ✅ Automatically detect region from law title during creation/editing (v1.6.5).
*   **Export Enhancement:** ✅ Complete structured JSON export with all fields (section, items, metadata) (v1.6.6).
*   **Import/Export Workflow:** ✅ Comprehensive documentation and scripts for batch operations (v1.6.6).
*   **Violation Module:** ✅ Full CRUD functionality with hierarchy display (v1.7.0).
*   **Violation Search:** ✅ Keyword search and card-based display (v1.7.0).
*   **Excel Batch Import:** ✅ Parse structured Excel files with 91.9% success rate (v1.8.0).
*   **Smart Law Matching:** ✅ 3-tier matching algorithm with 85% improvement (v1.8.0).
*   **Local Network Deployment:** ✅ PM2 background running + firewall configuration (v1.8.0).
*   **Production Environment Fix:** ✅ Fixed Prisma transaction errors in production mode (v1.8.0).
*   **Admin List Optimization:** ✅ Server-side pagination, toast feedback, sort-preserves-filters, ResizableHeader extraction (v1.8.0).
*   **Mobile Adaptation:** ✅ MobileFilterPanel, mobile search bar on all pages (v1.8.0).
*   **Code Quality:** ✅ TypeScript interfaces (LawItem, ViolationStatItem), CSS static file, reduced `any` usage (v1.8.0).
*   **Testing:** Verify text parser edge cases and mobile responsiveness.
*   **Deployment:** ✅ Deployed on local network (192.168.1.16:3000).

## 5. How to Resume Work
1.  **Read this file** to understand the scope.
2.  **Check Database:** Run `node check-db.js` to verify data integrity.
3.  **Start Dev Server:** Run `npm run dev`.

## 6. Performance Optimization Strategy 🚀

### Current Status
- **Data Volume:** 420 laws (v1.8.0)
- **Database:** SQLite (perfect fit for current scale)
- **Performance:** Excellent (< 50ms for all queries), server-side pagination (v1.8.0)
- **Categories:** 11 levels, 17 categories (v1.7.0)

### Optimization Strategy: Data First, Optimize Later

#### Phase 1: Data Quality (Current Priority) ✅
- Focus on cleaning up existing 361 laws ✅
- Fix metadata issues ✅
- Standardize naming conventions ✅
- **Goal:** High-quality, structured data ✅ Achieved in v1.6.4

#### Phase 2: Feature Completion (Next)
- Complete all required features
- Test all user scenarios
- Collect feedback
- **Goal:** Feature-complete application

#### Phase 3: Performance Optimization (After Data Stable)
**When:**
- Data quality is stable
- Scale approaches 3,000+ laws
- Users report performance issues

**What:**
- Add database indexes (see `docs/OPTIMIZATION.md`)
- Performance testing and benchmarking
- Add caching if needed (Redis)
- Consider full-text search (FTS5 or MeiliSearch)

### Why This Order?
1. **SQLite Performance** - Handles 6,000+ laws easily without optimization
2. **Data Quality > Query Speed** - Bad data can't be found, fast or slow
3. **Avoid Premature Optimization** - Optimization during data changes is wasted effort
4. **Migration Path** - Prisma makes MySQL migration easy if needed (one-line change)

### Quick Reference
- **Current:** 420 laws, no indexes needed
- **Future:** 6,000 laws, add indexes when stable
- **Detailed Guide:** See `docs/OPTIMIZATION.md`
