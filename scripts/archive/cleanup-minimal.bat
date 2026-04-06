@echo off
REM ========================================
REM 最小清理脚本 - 方案1
REM ========================================
REM 保留 .next/ 缓存
REM 删除导出文件和临时脚本
REM ========================================

echo.
echo ========================================
echo 执行最小清理（方案1）
echo ========================================
echo.
echo 将要删除的内容：
echo   - laws-exported/ 目录
echo   - 临时数据迁移脚本（20个）
echo.
echo 将要保留的内容：
echo   - .next/ 缓存（加速开发）
echo   - cleanup-project.bat
echo.
echo ========================================
echo.

pause

REM 1. 删除导出的法规文件
echo [1/2] 删除导出的法规文件...
if exist laws-exported (
    rmdir /s /q laws-exported
    echo     √ 已删除 laws-exported 目录 (9MB)
) else (
    echo     - laws-exported 目录不存在
)

REM 2. 删除临时脚本（保留 cleanup-project.bat）
echo [2/2] 删除临时数据迁移脚本...

echo     删除以下脚本：
echo     - add-region-column.js
echo     - add-year-to-titles.js
echo     - assign-regions.js
echo     - check-data.js
echo     - check-db.js
echo     - check-prisma-db.js
echo     - check-root-db.js
echo     - check-status.js
echo     - check-table-structure.js
echo     - check-titles.js
echo     - find-duplicates.js
echo     - fix-all-duplicates.js
echo     - fix-duplicate-suffix.js
echo     - fix-title-brackets.js
echo     - move-docnum-to-preamble.js
echo     - preview-full.js
echo     - preview-with-preamble.js
echo     - process-data.js
echo     - process-document-numbers.js
echo.

del /q add-region-column.js 2>nul
del /q add-year-to-titles.js 2>nul
del /q assign-regions.js 2>nul
del /q check-data.js 2>nul
del /q check-db.js 2>nul
del /q check-prisma-db.js 2>nul
del /q check-root-db.js 2>nul
del /q check-status.js 2>nul
del /q check-table-structure.js 2>nul
del /q check-titles.js 2>nul
del /q find-duplicates.js 2>nul
del /q fix-all-duplicates.js 2>nul
del /q fix-duplicate-suffix.js 2>nul
del /q fix-title-brackets.js 2>nul
del /q move-docnum-to-preamble.js 2>nul
del /q preview-full.js 2>nul
del /q preview-with-preamble.js 2>nul
del /q process-data.js 2>nul
del /q process-document-numbers.js 2>nul

echo     √ 已删除所有临时脚本
echo     √ 已保留 cleanup-project.bat

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 保留的项目：
echo   √ .next/ 缓存（224MB）
echo   √ cleanup-project.bat
echo   √ dev.db（数据库文件）
echo   √ node_modules/（依赖包）
echo.
echo 已删除：
echo   √ laws-exported/ (9MB)
echo   √ 20个临时脚本 (~100KB)
echo.
echo 下次启动 npm run dev 时会使用现有的缓存，速度较快。
echo.
pause
