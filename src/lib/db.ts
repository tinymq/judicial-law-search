import { PrismaClient } from '@prisma/client'
import path from 'path'

// 1. 获取绝对路径
const dbPath = path.join(process.cwd(), 'dev.db')

// 2. 强制覆盖环境变量 (这是最稳妥的方式)
// 注意：Windows 路径可能需要转义，但 Node.js 通常能处理
process.env.DATABASE_URL = `file:${dbPath}`

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 3. 此时初始化不需要任何参数，它会自动读取我们刚刚设置的 env
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// ✅ 修复：生产环境也缓存 Prisma Client 实例，避免事务错误
globalForPrisma.prisma = prisma