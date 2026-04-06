# 故障排除指南 (Troubleshooting Guide)

记录项目开发过程中的常见问题和解决方案。

---

## 快速诊断

| 问题 | 症状 | 快速检查 |
|------|------|---------|
| **数据库连接失败** | `Error: Database file not found` | 检查 `dev.db` 是否存在 |
| **Prisma 刷新慢** | VSCode 中看不到新表 | 关闭数据库后重新打开 |
| **构建失败** | TypeScript 错误 | 运行 `npm run build` 查看详细错误 |
| **端口占用** | `Port 3000 is already in use` | 关闭占用端口的程序 |

---

## 问题1：经济特区法规区域识别错误

**日期**: 2026-01-26 | **状态**: ✅ 已修复

### 问题
标题包含"经济特区"的法规被错误识别为"全国"。

### 解决方案
在 `app/admin/utils/contentParser.ts` 中添加特殊区域前缀匹配：
```typescript
const SPECIAL_REGION_PREFIXES = [
  { prefix: '海南经济特区', region: '海南' },
  { prefix: '深圳经济特区', region: '深圳' },
  { prefix: '厦门经济特区', region: '厦门' },
  { prefix: '珠海经济特区', region: '珠海' },
  { prefix: '汕头经济特区', region: '汕头' },
];
```

---

## 问题2：Prisma事务超时错误

**日期**: 2026-01-26 | **状态**: ✅ 已修复

### 问题
编辑大型法规（68条以上）时保存失败，报错：
```
Transaction API error: Transaction not found
```

### 原因
Prisma 默认事务超时5秒，大量操作超过限制。

### 解决方案
增加事务超时配置：
```typescript
await prisma.$transaction(async (tx) => {
  // ...
}, {
  maxWait: 10000,  // 最大等待时间：10秒
  timeout: 30000,  // 事务超时时间：30秒
});
```

---

## 问题3：管理后台列表页配置不一致

**日期**: 2026-01-26 | **状态**: ✅ 已修复

### 问题
下拉选项与数据库值不一致，显示错误。

### 解决方案
统一使用 `src/lib/category-config.ts` 的配置。

---

## 常见错误信息

### `Error: Database is locked`
**原因**: SQLite 不支持并发写入
**解决**: 确保只有一个进程在写入数据库

### `Cannot find module '@prisma/client'`
**原因**: Prisma Client 未生成
**解决**: 运行 `npx prisma generate`

### `TypeError: Cannot read property 'xxx' of undefined`
**原因**: 数据库查询返回 undefined
**解决**: 检查数据库中是否有数据，运行 `node scripts/check-db.js`

---

## 数据库调试

### 查看 Prisma 日志
在 `src/lib/db.ts` 中添加：
```typescript
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### 使用 Prisma Studio
```bash
npx prisma studio
# 打开 http://localhost:5555
```

### 重置数据库
```bash
# 删除数据库
rm dev.db

# 重新导入
node prisma/import-json.js
```

---

**最后更新**: 2026-01-26 | **维护者**: 项目团队
