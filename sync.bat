@echo off
echo ========================================
echo   天线支架硬性指标看板 - 飞书数据同步
echo ========================================
echo.

cd /d D:\Claude\repos\akemengshou.github.io

echo [1/3] 正在从飞书读取数据...
echo 请在Claude Code中运行: /sync-feishu
echo.
echo 或者手动执行以下步骤:
echo 1. 使用飞书MCP读取数据
echo 2. 更新data.json文件
echo 3. 推送到GitHub
echo.

echo [2/3] 提交更改...
git add data.json
git commit -m "update: 同步飞书数据 %date% %time%"

echo [3/3] 推送到GitHub...
git push origin main

echo.
echo ========================================
echo   同步完成！请刷新浏览器查看最新数据
echo   访问: https://akemengshou.github.io/
echo ========================================
pause
