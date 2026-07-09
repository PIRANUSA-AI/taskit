import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, type UserCredential } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp | undefined
let googleProvider: GoogleAuthProvider | undefined

function init() {
  if (!app) {
    app = initializeApp(firebaseConfig)
    googleProvider = new GoogleAuthProvider()
  }
  return { app, googleProvider }
}

export async function signInWithGoogle(): Promise<string> {
  const { googleProvider } = init()
  const auth = getAuth(app!)
  const result: UserCredential = await signInWithPopup(auth, googleProvider!)
  const idToken = await result.user.getIdToken()
  return idToken
}
