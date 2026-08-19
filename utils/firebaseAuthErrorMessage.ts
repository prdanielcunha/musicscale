export type FirebaseAuthErrorLike = {
  code?: string;
};

export const getFirebaseErrorMessage = (error: FirebaseAuthErrorLike): string => {
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
      console.error('Firebase Auth Error:', error.code);
      return 'Ocorreu um erro desconhecido. Tente novamente.';
  }
};
