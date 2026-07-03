import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and, or, sql, asc, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client.js'
import { actionItems, users } from '../db/schema.js'
import { requireAdmin, type AppEnv } from '../middleware/auth.js'

const createSchema = z.object({
  owner: z.string().min(1).max(80),
  task: z.string().min(2).max(400),
  due: z.string().max(80).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})

const updateSchema = z.object({
  owner: z.string().min(1).max(80).optional(),
  task: z.string().min(2).max(400).optional(),
  due: z.string().max(80).nullable().optional(),
  done: z.boolean().optional(),
})

export const playgroundRouter = new Hono<AppEnv>()

playgroundRouter.use('*', requireAdmin)

playgroundRouter.get('/tasks', async (c) => {
  const rows = await db
    .select({
      id: actionItems.id,
      jobId: actionItems.jobId,
      owner: actionItems.owner,
      assigneeId: actionItems.assigneeId,
      task: actionItems.task,
      due: actionItems.due,
      confidence: actionItems.confidence,
      done: actionItems.done,
      order: actionItems.order,
      createdAt: actionItems.createdAt,
    })
    .from(actionItems)
    .where(sql`${actionItems.jobId} IS NULL`)
    .orderBy(asc(actionItems.createdAt))

  return c.json({ tasks: rows })
})

playgroundRouter.get('/users', async (c) => {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .orderBy(asc(users.username))

  return c.json({ users: rows })
})

playgroundRouter.post('/tasks', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Input tidak valid' }, 400)
  }

  const id = nanoid()
  await db.insert(actionItems).values({
    id,
    jobId: null,
    owner: parsed.data.owner.trim(),
    task: parsed.data.task.trim(),
    due: parsed.data.due ?? null,
    assigneeId: parsed.data.assigneeId ?? null,
    confidence: 1,
    done: false,
    order: 0,
  })

  const [created] = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.id, id))
    .limit(1)

  return c.json(created, 201)
})

playgroundRouter.patch('/tasks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Input tidak valid' }, 400)
  }

  const [existing] = await db
    .select({ id: actionItems.id, jobId: actionItems.jobId })
    .from(actionItems)
    .where(eq(actionItems.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Tugas tidak ditemukan' }, 404)
  if (existing.jobId) return c.json({ error: 'Tugas dari transkrip tidak bisa diedit di sini' }, 403)

  const patch: Record<string, unknown> = {}
  if (parsed.data.owner !== undefined) patch.owner = parsed.data.owner.trim()
  if (parsed.data.task !== undefined) patch.task = parsed.data.task.trim()
  if (parsed.data.due !== undefined) patch.due = parsed.data.due
  if (parsed.data.done !== undefined) patch.done = parsed.data.done

  await db.update(actionItems).set(patch).where(eq(actionItems.id, id))

  const [updated] = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.id, id))
    .limit(1)

  return c.json(updated)
})

playgroundRouter.delete('/tasks/:id', async (c) => {
  const id = c.req.param('id')

  const [existing] = await db
    .select({ id: actionItems.id, jobId: actionItems.jobId })
    .from(actionItems)
    .where(eq(actionItems.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Tugas tidak ditemukan' }, 404)
  if (existing.jobId) return c.json({ error: 'Tugas dari transkrip tidak bisa dihapus di sini' }, 403)

  await db.delete(actionItems).where(eq(actionItems.id, id))
  return c.json({ ok: true })
})
