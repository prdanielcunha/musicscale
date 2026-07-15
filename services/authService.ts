
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type AuthError,
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
  signInWithPopup
} from 'firebase/auth';
import { auth } from './firebase';
// FIX: Corrected import path and usage to treat firestoreService as a module.
import { createUserProfile, getUserProfileData } from './firestoreService';
import type { User } from '../types';

export const signUpWithEmail = async (email: string, password: string, displayName: string, roleName?: string): Promise<UserCredential> => {
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update the new user's profile in Firebase Auth to include their name
  await updateProfile(userCredential.user, { displayName });
  // After user is created in Auth, create their profile in Firestore.
  // They will not have an organizationId yet.
  await createUserProfile(userCredential.user, '', roleName);
  return userCredential;
};

export const signInWithEmail = async (email: string, password: string, keepLoggedIn: boolean): Promise<any> => {
  await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = async (): Promise<UserCredential> => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if user profile exists in database
    const profile = await getUserProfileData(userCredential.user.uid);
    if (!profile) {
        // Create basic profile if it acts as a standalone fallback
        await createUserProfile(userCredential.user, '', 'visitor');
    }
    
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

export const getFirebaseErrorMessage = (error: AuthError): string => {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'O formato do e-mail é inválido.';
        case 'auth/user-disabled':
            return 'Este usuário foi desabilitado.';
        case 'auth/user-not-found':
            return 'Nenhum usuário encontrado com este e-mail.';
        case 'auth/wrong-password':
            return 'Senha incorreta. Tente novamente.';
        case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso por outra conta.';
        case 'auth/weak-password':
            return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
        case 'auth/operation-not-allowed':
            return 'O método de login não está habilitado.';
        case 'auth/requires-recent-login':
            return 'Esta operação é sensível e requer autenticação recente. Faça login novamente antes de tentar novamente.';
        case 'auth/popup-blocked':
            return 'O popup de login foi bloqueado pelo navegador. Permita popups para este site.';
        case 'auth/popup-closed-by-user':
            return 'O login foi cancelado (popup fechado).';
        case 'auth/unauthorized-domain':
            return 'Este domínio não está autorizado no Firebase. Verifique Authorized Domains no Firebase Console.';
        case 'auth/operation-not-supported-in-this-environment':
            return 'Esta operação não é suportada neste ambiente. Tente a URL publicada.';
        case 'auth/internal-error':
            return 'Erro interno de autenticação. Tente novamente mais tarde.';
        case 'auth/cancelled-popup-request':
            return 'Uma solicitação de popup já estava em andamento.';
        default:
            console.error("Firebase Auth Error:", error.code);
            return 'Ocorreu um erro desconhecido. Tente novamente.';
    }
};
