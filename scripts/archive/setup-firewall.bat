@echo off
echo ====================================
echo 配置防火墙规则
echo ====================================
echo.
echo 此脚本将添加防火墙入站规则，允许端口 3000
echo.
pause

echo 正在添加防火墙规则...
powershell -Command "New-NetFirewallRule -DisplayName 'Next.js Market Law Search (Port 3000)' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo 成功！防火墙规则已添加
    echo ====================================
    echo.
    echo 验证规则...
    powershell -Command "Get-NetFirewallRule -DisplayName 'Next.js Market Law Search (Port 3000)' | Select-Object DisplayName, Enabled, Direction"
) else (
    echo.
    echo ====================================
    echo 失败！请以管理员身份运行此脚本
    echo ====================================
    echo.
    echo 操作方法：
    echo 1. 右键点击此文件
    echo 2. 选择"以管理员身份运行"
    echo.
)

pause
