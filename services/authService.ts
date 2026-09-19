import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  UserCredential,
  deleteUser,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserProfile, getUserProfileData } from './firestoreService';
import type { User } from '../types';
export { getFirebaseErrorMessage } from '../utils/firebaseAuthErrorMessage';

/**
 * Browser persistence is a real-product concern. Playwright's emulator contexts
 * are disposable and already isolated per browser/project; switching persistence
 * before sign-in can stall Firebase Auth initialization under mobile emulation.
 * Keep production remember-me behavior unchanged and skip only in explicit E2E mode.
 */
const isE2EAuthMode = (): boolean => {
  return import.meta.env?.VITE_E2E_MODE === 'true';
};

export const signUpWithEmail = async (email: string, password: string, displayName: string, roleName?: string): Promise<UserCredential> => {
  if (!isE2EAuthMode()) {
    await setPersistence(auth, browserLocalPersistence);
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Update the new user's profile in Firebase Auth to include their name
  await updateProfile(userCredential.user, { displayName });
  // After user is created in Auth, create their profile in Firestore.
  // They will not have an organizationId yet.
  await createUserProfile(userCredential.user, '', roleName);
  return userCredential;
};

export const signInWithEmail = async (email: string, password: string, keepLoggedIn: boolean): Promise<any> => {
  if (!isE2EAuthMode()) {
    await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
  }
  return signInWithEmailAndPassword(auth, email, password);
};

const GOOGLE_PROFILE_SYNC_TIMEOUT_MS = 5000;
export const GOOGLE_REDIRECT_PENDING_KEY = 'musicscale_google_redirect_pending';

const withAuthSideEffectTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('AUTH_SIDE_EFFECT_TIMEOUT')), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

const syncGoogleProfile = (userCredential: UserCredential) => {
  // Authentication is authoritative here. Firestore profile hydration is a
  // follow-up side effect and must never keep a successful Google login spinning.
  void (async () => {
    try {
      const profile = await withAuthSideEffectTimeout(
        getUserProfileData(userCredential.user.uid),
        GOOGLE_PROFILE_SYNC_TIMEOUT_MS
      );
      if (!profile) {
        await withAuthSideEffectTimeout(
          createUserProfile(userCredential.user, '', 'visitor'),
          GOOGLE_PROFILE_SYNC_TIMEOUT_MS
        );
      }
    } catch (error) {
      console.warn('[MusicScale Auth] Google sign-in succeeded; deferred profile sync will retry during bootstrap.', error);
    }
  })();
};

export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider());
    syncGoogleProfile(userCredential);
    return userCredential;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/operation-not-supported-in-this-environment' ||
      error?.code === 'auth/web-storage-unsupported'
    ) {
      try { sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1'); } catch {}
      await signInWithRedirect(auth, googleProvider());
      return null;
    }
    throw error;
  }
};

export const finishGoogleRedirectSignIn = async (): Promise<UserCredential | null> => {
  const userCredential = await getRedirectResult(auth);
  try { sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch {}
  if (userCredential) syncGoogleProfile(userCredential);
  return userCredential;
};

export const signOutUser = (): Promise<void> => {
  localStorage.removeItem('ecosystem_support_session');
  localStorage.removeItem('inviteOrgId');
  return signOut(auth);
};

export const updateUserProfile = ({ displayName, photoURL }: { displayName?: string; photoURL?: string }) => {
  if (!auth.currentUser) {
    throw new Error("No user is currently signed in.");
  }
  return updateProfile(auth.currentUser, { displayName, photoURL });
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
        throw new Error("Usuário não autenticado ou sem e-mail para reautenticação.");
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    // Re-authenticate the user to confirm their identity
    await reauthenticateWithCredential(user, credential);

    // If re-authentication is successful, update the password
    await updatePassword(user, newPassword);
};

export const sendResetEmail = async (email: string) => {
    return sendPasswordResetEmail(auth, email);
};

export const reauthenticateCurrentUser = async (password: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user || !user.email) {
        throw new Error("Usuário não autenticado ou sem e-mail para reautenticação.");
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    // Re-authenticate before a sensitive operation
    await reauthenticateWithCredential(user, credential);
};

export const deleteAuthUser = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Nenhum usuário encontrado para excluir.");
    }
    await deleteUser(user);
};
