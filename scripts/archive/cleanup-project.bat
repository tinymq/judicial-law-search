@echo off
chcp 65001 > nul
echo ========================================
echo 项目清理脚本
echo ========================================
echo.

echo [1/4] 清理 Next.js 构建缓存...
if exist .next (
    rmdir /s /q .next
    echo ✓ 已删除 .next 目录
) else (
    echo ℹ .next 目录不存在
)

echo.
echo [2/4] 清理临时脚本文件...
del /q add-lawgroupid-field.js 2>nul
del /q add-preamble-field.js 2>nul
del /q add-preamble-input.js 2>nul
del /q add-preamble-to-formData.js 2>nul
del /q check-lawgroupid.js 2>nul
del /q check-db.js 2>nul
del /q dev-server.log 2>nul
del /q nul 2>nul
echo ✓ 已删除临时文件

echo.
echo [3/4] 检查 lawsforgemini 文件夹...
if exist lawsforgemini (
    echo ℹ lawsforgemini 文件夹存在（包含 359 个 JSON 源文件）
    echo ℹ 提示：数据已导入数据库后，可以将此文件夹移到备份位置
)

echo.
echo [4/4] 清理开发日志...
if exist .next\dev\logs (
    del /q .next\dev\logs\*.log 2>nul
    echo ✓ 已删除开发日志
)

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 建议后续操作：
echo 1. 将 lawsforgemini 文件夹移到其他位置备份
echo 2. 运行 npm run dev 重新构建（会自动生成 .next）
echo.
pause
