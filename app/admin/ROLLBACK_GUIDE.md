# 管理后台优化回滚指南

## 🔄 如何回滚优化

### 方法1：通过URL参数控制（推荐）

访问页面时添加 `?theme=legacy` 参数即可查看原始设计：
- http://localhost:3000/admin/laws?theme=legacy
- http://localhost:3000/admin/violations?theme=legacy

### 方法2：修改配置文件

编辑 `app/admin/admin-config.ts`：
```typescript
export const ADMIN_CONFIG = {
  theme: 'legacy', // 改为 'legacy' 即可回滚
};
```

### 方法3：删除CSS文件

删除以下文件可完全移除优化：
```
app/admin/admin-styles.css
app/admin/admin-config.ts
```

然后从页面中移除 `admin-optimized` className。

## 📝 修改的文件清单

### 已修改的文件（需回滚时恢复）
1. `app/admin/laws/page.tsx` - 添加了 className
2. `app/admin/laws/LawTable.tsx` - 添加了 className
3. `components/LawSidebar.tsx` - 添加了 className
4. `components/SiteHeader.tsx` - 添加了 className

### 新增的文件（可直接删除）
1. `app/admin/admin-styles.css` - 优化样式
2. `app/admin/admin-config.ts` - 配置文件
3. `app/admin/ROLLBACK_GUIDE.md` - 本文件

## 🔧 快速回滚命令

```bash
# 方式1：删除新增文件
rm app/admin/admin-styles.css
rm app/admin/admin-config.ts

# 然后手动编辑修改的文件，移除 admin-optimized className
```

## ✅ 测试确认

回滚后请测试：
- [ ] 页面恢复正常外观
- [ ] 所有功能正常工作
- [ ] 没有样式错误
