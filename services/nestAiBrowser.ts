import { auth, getMusicScaleAppCheckToken } from './firebase';

export async function nestAiProtectedHeaders(includeJson = true): Promise<Record<string,string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('NESTAI_USER_NOT_AUTHENTICATED');
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getMusicScaleAppCheckToken(),
  ]);
  return {
    authorization: 'Bearer ' + idToken,
    'x-firebase-appcheck': appCheckToken,
    ...(includeJson ? { 'content-type': 'application/json' } : {}),
  };
}
