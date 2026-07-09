import { initializeApp, getApps, cert, type AppOptions } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const ALLOWED_DOMAINS = ['piranusa.com', 'contrivent.com']

let initialized = false

function ensureInit() {
  if (initialized) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) return

  const opts: AppOptions = {
    projectId,
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  }

  if (getApps().length === 0) {
    initializeApp(opts)
  }
  initialized = true
}

export interface FirebaseUser {
  uid: string
  email: string
  name: string
  picture?: string
}

export async function verifyGoogleToken(idToken: string): Promise<FirebaseUser> {
  ensureInit()

  if (!initialized) {
    throw new Error('Firebase not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
  }

  const decoded = await getAuth().verifyIdToken(idToken)

  const email = decoded.email
  if (!email) {
    throw new Error('Akun Google tidak memiliki email')
  }

  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    throw new Error(`Email ${email} tidak diizinkan. Hanya @piranusa.com atau @contrivent.com`)
  }

  return {
    uid: decoded.uid,
    email,
    name: decoded.name ?? email.split('@')[0],
    picture: decoded.picture,
  }
}
