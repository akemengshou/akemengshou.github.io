# 飞书数据同步说明

## 方法一：在Claude Code中运行（推荐）

在Claude Code中直接运行以下命令：

```
/sync-feishu
```

或手动执行：

1. 读取飞书数据
2. 更新 data.json
3. 推送到GitHub

## 方法二：使用同步脚本

```powershell
cd D:\Claude\repos\akemengshou.github.io
node sync-feishu.js
```

## 方法三：手动同步

1. 在Claude Code中读取飞书数据
2. 复制数据到 data.json
3. 提交并推送到GitHub

```bash
git add data.json
git commit -m "update: 同步飞书数据"
git push origin main
```

4. 刷新浏览器查看最新数据
