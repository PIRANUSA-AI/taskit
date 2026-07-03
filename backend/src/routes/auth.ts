import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import { eq, and, sum, max, count, or, sql, asc, desc } from 'drizzle-orm'
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  createUser,
  deleteSession,
  findUserByUsername,
  verifyPassword,
} from '../services/auth.js'
import { requireAuth, type AppEnv } from '../middleware/auth.js'
import { db } from '../db/client.js'
import { actionItems, jobs, users } from '../db/schema.js'
import { cacheUserStats, getCachedUserStats, cacheIncrWithTtl, cacheDelete, cacheGet } from '../services/cache.js'
import { nanoid } from 'nanoid'

const DEEPGRAM_COST_PER_MIN = 0.0043
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10)
const LOGIN_RATE_LIMIT_WINDOW_SEC = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SEC ?? 15 * 60)
// When "1", allow public self-signup via POST /auth/register (used by the
// PIRANUSA welcome onboarding flow). Off by default — admin-only account
// creation remains the gate for internal team membership.
const ALLOW_PUBLIC_SIGNUP = process.env.ALLOW_PUBLIC_SIGNUP === '1'
// Welcome credits granted to a newly self-registered user (seconds).
const SIGNUP_CREDIT_SECONDS = Number(process.env.SIGNUP_CREDIT_SECONDS ?? 0)

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
})

export const authRouter = new Hono<AppEnv>()

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)

  const rateLimitKey = loginRateLimitKey(c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'local', parsed.data.username)
  if (await isLoginRateLimited(rateLimitKey)) {
    return c.json({ error: 'Terlalu banyak percobaan login. Coba lagi nanti.' }, 429)
  }

  const user = await findUserByUsername(parsed.data.username.trim())
  if (!user) {
    await recordFailedLogin(rateLimitKey)
    return c.json({ error: 'Username atau password salah' }, 401)
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) {
    await recordFailedLogin(rateLimitKey)
    return c.json({ error: 'Username atau password salah' }, 401)
  }

  const { token } = await createSession(user.id)
  const secure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
  c.header('Set-Cookie', buildSessionCookie(token, { secure }))
  await clearFailedLogin(rateLimitKey)

  return c.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    displayName: user.displayName,
  })
})

authRouter.post('/logout', async (c) => {
  const token = getCookie(c, 'session')
  if (token) await deleteSession(token)
  const secure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
  c.header('Set-Cookie', clearSessionCookie({ secure }))
  return c.json({ ok: true })
})

const registerSchema = z.object({
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_.-]+$/, 'Username hanya huruf, angka, _ . -'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(256),
  displayName: z.string().min(1).max(80).optional(),
})

authRouter.post('/register', async (c) => {
  if (!ALLOW_PUBLIC_SIGNUP) {
    return c.json({ error: 'Pendaftaran ditutup. Hubungi admin untuk akun.' }, 403)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Input tidak valid' }, 400)
  }

  const existing = await findUserByUsername(parsed.data.username)
  if (existing) return c.json({ error: 'Username sudah dipakai' }, 409)

  const user = await createUser({
    username: parsed.data.username.trim(),
    password: parsed.data.password,
    displayName: parsed.data.displayName?.trim() || parsed.data.username.trim(),
    creditSeconds: SIGNUP_CREDIT_SECONDS,
  })

  const { token } = await createSession(user.id)
  const secure = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
  c.header('Set-Cookie', buildSessionCookie(token, { secure }))

  return c.json(
    {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      displayName: user.displayName,
      creditSeconds: user.creditSeconds,
    },
    201
  )
})

authRouter.get('/signup-status', (c) => {
  return c.json({ enabled: ALLOW_PUBLIC_SIGNUP })
})

authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  const [row] = await db
    .select({ creditSeconds: users.creditSeconds })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  return c.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    displayName: user.displayName,
    creditSeconds: row?.creditSeconds ?? 0,
  })
})

authRouter.get('/me/tasks', requireAuth, async (c) => {
  const user = c.get('user')
  const matchName = (user.displayName ?? user.username).trim().toLowerCase()

  const rows = await db
    .select({
      id: actionItems.id,
      jobId: actionItems.jobId,
      owner: actionItems.owner,
      task: actionItems.task,
      due: actionItems.due,
      confidence: actionItems.confidence,
      done: actionItems.done,
      order: actionItems.order,
      createdAt: actionItems.createdAt,
      jobTitle: jobs.title,
      jobFilename: jobs.filename,
      jobCreatedAt: jobs.createdAt,
      jobCompletedAt: jobs.completedAt,
    })
    .from(actionItems)
    .leftJoin(jobs, eq(jobs.id, actionItems.jobId))
    .where(
      and(
        or(sql`${actionItems.jobId} IS NULL`, eq(jobs.status, 'completed')),
        or(eq(actionItems.assigneeId, user.id), sql`LOWER(${actionItems.owner}) = ${matchName}`)
      )
    )
    .orderBy(desc(sql`COALESCE(${jobs.createdAt}, ${actionItems.createdAt})`), asc(actionItems.order), asc(actionItems.createdAt))

  const playgroundId = '__playground'
  const byJob = new Map<
    string,
    {
      jobId: string
      title: string | null
      filename: string
      createdAt: Date
      completedAt: Date | null
      items: typeof rows
    }
  >()

  for (const r of rows) {
    const key = r.jobId ?? playgroundId
    const existing = byJob.get(key)
    if (existing) {
      existing.items.push(r)
    } else {
      byJob.set(key, {
        jobId: key,
        title: r.jobTitle,
        filename: r.jobFilename ?? '',
        createdAt: r.jobCreatedAt ?? r.createdAt,
        completedAt: r.jobCompletedAt,
        items: [r],
      })
    }
  }

  const openCount = rows.filter((r) => !r.done).length

  return c.json({
    user: { username: user.username, displayName: user.displayName ?? user.username },
    openCount,
    totalCount: rows.length,
    groups: [...byJob.values()],
  })
})

const meTaskPatchSchema = z.object({
  itemId: z.string().min(1),
  done: z.boolean().optional(),
  task: z.string().min(1).max(400).optional(),
  due: z.string().max(80).nullable().optional(),
})

authRouter.patch('/me/tasks', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const parsed = meTaskPatchSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Input tidak valid' }, 400)
  }

  const matchName = (user.displayName ?? user.username).trim().toLowerCase()

  const [item] = await db
    .select({ id: actionItems.id, assigneeId: actionItems.assigneeId, owner: actionItems.owner })
    .from(actionItems)
    .where(eq(actionItems.id, parsed.data.itemId))
    .limit(1)
  if (!item) return c.json({ error: 'Tugas tidak ditemukan' }, 404)

  const owned =
    item.assigneeId === user.id || (item.owner ?? '').trim().toLowerCase() === matchName
  if (!owned) return c.json({ error: 'Tugas ini bukan milik kamu' }, 403)

  const patch: Record<string, unknown> = {}
  if (parsed.data.done !== undefined) patch.done = parsed.data.done
  if (parsed.data.task !== undefined) patch.task = parsed.data.task
  if (parsed.data.due !== undefined) patch.due = parsed.data.due
  if (item.assigneeId === null) patch.assigneeId = user.id
  if (Object.keys(patch).length === 0) return c.json({ ok: true, unchanged: true })

  await db.update(actionItems).set(patch).where(eq(actionItems.id, parsed.data.itemId))
  return c.json({ ok: true })
})

const meDisplayNameSchema = z.object({
  displayName: z.string().min(1).max(80),
})

authRouter.patch('/me/display-name', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const parsed = meDisplayNameSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Input tidak valid' }, 400)
  }
  await db
    .update(users)
    .set({ displayName: parsed.data.displayName.trim() })
    .where(eq(users.id, user.id))
  return c.json({ ok: true, displayName: parsed.data.displayName.trim() })
})

authRouter.post('/me/task-token', requireAuth, async (c) => {
  const user = c.get('user')
  const token = nanoid()
  const [updated] = await db
    .update(users)
    .set({ taskShareToken: token })
    .where(eq(users.id, user.id))
    .returning({ taskShareToken: users.taskShareToken })
  if (!updated) return c.json({ error: 'User tidak ditemukan' }, 404)
  return c.json({ taskShareToken: updated.taskShareToken, taskPath: `/tasks/${updated.taskShareToken}` })
})

authRouter.get('/me/stats', requireAuth, async (c) => {
  const user = c.get('user')

  const cached = await getCachedUserStats(user.id)
  if (cached) return c.json(cached)

  const [agg] = await db
    .select({
      totalDurationSec: sum(jobs.durationSec),
      latestDurationSec: max(jobs.durationSec),
      totalJobs: count(jobs.id),
    })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.status, 'completed')))

  const [userRow] = await db
    .select({ creditSeconds: users.creditSeconds, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  const totalDurationSec = Number(agg?.totalDurationSec ?? 0)
  const estimatedCostUSD = parseFloat(((totalDurationSec / 60) * DEEPGRAM_COST_PER_MIN).toFixed(4))

  const stats = {
    totalDurationSec,
    latestDurationSec: Number(agg?.latestDurationSec ?? 0),
    totalJobs: Number(agg?.totalJobs ?? 0),
    creditSeconds: userRow?.creditSeconds ?? 0,
    estimatedCostUSD,
    memberSince: userRow?.createdAt ?? null,
  }

  await cacheUserStats(user.id, stats)
  return c.json(stats)
})

function loginRateLimitKey(ip: string, username: string): string {
  return `login:${ip.split(',')[0].trim()}:${username.trim().toLowerCase()}`
}

async function isLoginRateLimited(key: string): Promise<boolean> {
  const stored = await getCachedLoginCount(key)
  if (stored === null) return false
  return stored >= LOGIN_RATE_LIMIT_MAX
}

async function recordFailedLogin(key: string): Promise<void> {
  await cacheIncrWithTtl(`rate:${key}`, LOGIN_RATE_LIMIT_WINDOW_SEC)
}

async function clearFailedLogin(key: string): Promise<void> {
  await cacheDelete(`rate:${key}`)
}

async function getCachedLoginCount(key: string): Promise<number | null> {
  return cacheGet<number>(`rate:${key}`)
}
