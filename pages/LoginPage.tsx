import { logger } from "../lib/logger";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  getFirebaseErrorMessage,
} from "../services/authService";
import Spinner from "../components/common/Spinner";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     
     const handoffError = params.get('handoff_error');
     if (handoffError) {
         if (handoffError === 'expired') {
             setError("Seu acesso automático expirou. Abra o MusicScale novamente pelo MillionsNest.");
         } else if (handoffError === 'invalid') {
             setError("Não foi possível validar o acesso automático. Abra o MusicScale novamente pelo MillionsNest.");
         } else if (handoffError === 'unavailable') {
             setError("Não foi possível concluir o acesso automático agora. Verifique sua conexão e tente novamente.");
         }
         
         const url = new URL(window.location.href);
         url.searchParams.delete('handoff_error');
         window.history.replaceState({}, '', url.toString());
     }
     
     const orgId = params.get('org');
     if (orgId) {
         localStorage.setItem('inviteOrgId', orgId);
     }
     
     const redirectStr = params.get('redirect');
     if (redirectStr && redirectStr.includes('invite=')) {
         setShowEmailForm(true);
         setIsRegister(true);
     }
  }, []);

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:suporte@millionsnest.com?subject=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(supportMessage)}`;
    window.location.href = mailtoLink;
    setShowSupportModal(false);
    setSupportSubject("");
    setSupportMessage("");
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const authResult = await signInWithGoogle();
      
      const params = new URLSearchParams(window.location.search);
      const redirectPath = params.get('redirect');
      if (redirectPath) {
         if (redirectPath.includes('invite=')) {
            const inviteParamMatch = redirectPath.match(/invite=([^&]+)/);
            if (inviteParamMatch && authResult && authResult.user) {
                const token = decodeURIComponent(inviteParamMatch[1]);
                try {
                  const { acceptInvite } = await import('../services/inviteService');
                  await acceptInvite(authResult.user, token);
                } catch(e) {}
            }
            window.location.href = '/';
         } else {
            navigate(redirectPath, { replace: true });
         }
      } else {
         navigate("/start", { replace: true });
      }
    } catch (err: any) {
      logger.error("Login error:", err);
      setError(getFirebaseErrorMessage(err) || "Falha ao autenticar com Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !displayName)) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      let authResult;
      if (isRegister) {
          authResult = await signUpWithEmail(email, password, displayName);
      } else {
          authResult = await signInWithEmail(email, password, rememberMe);
      }

      const params = new URLSearchParams(window.location.search);
      const redirectPath = params.get('redirect');
      if (redirectPath) {
         if (redirectPath.includes('invite=')) {
            const inviteParamMatch = redirectPath.match(/invite=([^&]+)/);
            if (inviteParamMatch && authResult && authResult.user) {
                const token = decodeURIComponent(inviteParamMatch[1]);
                try {
                  const { acceptInvite } = await import('../services/inviteService');
                  await acceptInvite(authResult.user, token);
                } catch(e) {}
            }
            window.location.href = '/';
         } else {
            navigate(redirectPath, { replace: true });
         }
      } else {
         navigate("/start", { replace: true });
      }
    } catch (err: any) {
      logger.error("Login error:", err);
      if (err.code === 'auth/user-not-found' && !isRegister) {
          setError("Usuário não encontrado. Crie uma conta primeiro.");
      } else {
          setError(getFirebaseErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex flex-col items-center p-4 sm:p-6 relative overflow-y-auto font-sans selection:bg-primary/20 isolate">
      {/* Cinematic Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-[0.03] dark:opacity-[0.06] mix-blend-overlay"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-80 md:blur-[100px] blur-[25px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-60 md:blur-[100px] blur-[25px] mix-blend-screen"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] relative z-10 my-auto py-12"
      >
        {/* Brand Identity */}
        <div className="text-center mb-10 md:mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center justify-center p-4 bg-white dark:bg-[#111111] rounded-[1.75rem] shadow-[0_1px_4px_rgba(0,0,0,0.02),0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] mb-8 border border-black/[0.04] dark:border-white/[0.05] hover:scale-105 transition-transform duration-500"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
              <img 
                src="/LogoIcon.png" 
                alt="MusicScale Logo" 
                className="w-full h-full object-contain drop-shadow-md"
              />
            </div>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tighter leading-tight mb-3">
            MusicScale
          </h1>
          <p className="text-slate-500 dark:text-[#888] text-base md:text-lg font-medium tracking-tight">
            Organização e excelência ministerial.
          </p>
        </div>

        {/* Login Interface */}
        <div className="glass-panel-heavy rounded-[2.5rem] shadow-apple-hover p-6 sm:p-10 md:p-12 space-y-6 md:space-y-8 relative overflow-hidden isolate">
          <div className="cinematic-noise"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/[0.04] pointer-events-none"></div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-[14px] font-semibold text-center tracking-tight shadow-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <AnimatePresence mode="wait">
              {!showEmailForm ? (
                <motion.div
                  key="social"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-5"
                >
                  <Button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    variant="secondary"
                    className="w-full h-[64px] text-[17px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.02)] border-black/5 dark:border-white/[0.06] rounded-[1.25rem] flex items-center justify-center gap-3"
                  >
                    {!loading && (
                      <svg
                        className="w-[24px] h-[24px] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18V20.16C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22-.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                    )}
                    {loading ? <Spinner size="sm" /> : "Continuar com Google"}
                  </Button>

                  <div className="flex items-center gap-4 py-1">
                    <div className="h-[1px] flex-1 bg-black/[0.04] dark:bg-white/[0.05]"></div>
                    <span className="text-[13px] font-semibold text-slate-400 dark:text-[#666] uppercase tracking-widest">
                      ou
                    </span>
                    <div className="h-[1px] flex-1 bg-black/[0.04] dark:bg-white/[0.05]"></div>
                  </div>

                  <button
                    onClick={() => setShowEmailForm(true)}
                    className="w-full h-[64px] flex items-center justify-center gap-3 text-primary font-bold text-[17px] hover:bg-primary/[0.04] dark:hover:bg-primary/[0.08] rounded-[1.25rem] transition-all active:scale-[0.985]"
                  >
                    <Mail className="w-[20px] h-[20px]" />
                    Acessar com e-mail
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onSubmit={handleEmailLogin}
                  className="space-y-6"
                >
                  {isRegister && (
                    <div className="space-y-2 relative isolate text-left">
                      <label htmlFor="register-display-name" className="block text-[13px] font-extrabold text-slate-800 dark:text-slate-200 px-1 tracking-tight">
                        Seu Nome
                      </label>
                      <div className="relative group w-full">
                        <input
                          id="register-display-name"
                          name="displayName"
                          autoComplete="name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="input-base w-full text-[16px] py-3.5 h-[56px] px-5 bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10 focus:ring-primary/20 shadow-sm-soft"
                          placeholder="Como quer ser chamado?"
                          required={isRegister}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 relative isolate text-left">
                    <label htmlFor="login-email" className="block text-[13px] font-extrabold text-slate-800 dark:text-slate-200 px-1 tracking-tight">
                      Endereço de e-mail
                    </label>
                    <div className="relative group w-full">
                      <input
                        id="login-email"
                        name="email"
                        autoComplete="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-base w-full text-[16px] py-3.5 h-[56px] px-5 bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10 focus:ring-primary/20 shadow-sm-soft"
                        placeholder="nome@igreja.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 relative isolate text-left">
                    <label htmlFor="login-password" className="block text-[13px] font-extrabold text-slate-800 dark:text-slate-200 px-1 tracking-tight">
                      Senha
                    </label>
                    <div className="relative group w-full flex items-center">
                      <input
                        id="login-password"
                        name="password"
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-base w-full text-[16px] py-3.5 h-[56px] pl-5 pr-14 bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10 focus:ring-primary/20 shadow-sm-soft"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 h-[40px] w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors outline-none cursor-pointer rounded-full hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        {showPassword ? (
                          <EyeOff className="w-[20px] h-[20px]" />
                        ) : (
                          <Eye className="w-[20px] h-[20px]" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="peer hidden"
                          checked={rememberMe}
                          onChange={() => setRememberMe(!rememberMe)}
                        />
                        <div className="w-[22px] h-[22px] border-2 border-slate-300 dark:border-[#333] rounded-md bg-white dark:bg-transparent peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 text-white transition-opacity ${rememberMe ? "opacity-100" : "opacity-0"}`}
                          />
                        </div>
                      </div>
                      <span className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
                        Permanecer conectado
                      </span>
                    </label>
                    
                    <button
                      type="button"
                      className="text-[13px] font-bold text-slate-500 hover:text-primary hover:underline transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  <div className="pt-2 space-y-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      size="lg"
                      variant="blue"
                      className="w-full h-[64px] text-[17px]"
                    >
                      {loading ? (
                        <Spinner size="sm" className="text-white" />
                      ) : (
                        isRegister ? "Criar Conta" : "Acessar Plataforma"
                      )}
                    </Button>
                    
                    <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRegister(!isRegister)}
                          className="w-full flex items-center justify-center gap-1 py-2 text-[14px] font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                          {isRegister ? "Já tenho uma conta. Fazer Login" : "Não tem conta? Criar uma agora"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => { setShowEmailForm(false); setIsRegister(false); }}
                          className="w-full flex items-center justify-center gap-2 py-3 text-[14px] font-semibold text-slate-500 dark:text-[#888] hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Voltar para opções
                        </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Ecosystem Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-10 space-y-8 relative z-10"
        >
          <p className="text-[12px] text-slate-500 dark:text-[#666] font-medium leading-relaxed max-w-[300px] mx-auto">
            Ao prosseguir, você concorda com nossos <br />
            <a
              href="#"
              className="text-primary font-bold hover:underline"
            >
              Termos de Uso
            </a>{" "}
            e{" "}
            <a
              href="#"
              className="text-primary font-bold hover:underline"
            >
              Política de Privacidade
            </a>
            .
          </p>

          <div className="pt-4 border-t border-black/5 dark:border-white/5 inline-block px-12">
            <a
              href="https://millionsnest.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-400 dark:text-[#555] hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <span className="text-[12px] font-bold tracking-widest uppercase opacity-80">
                MillionsNest Ecosystem
              </span>
            </a>
          </div>
        </motion.div>
      </motion.div>

      {/* Float Support Action */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setShowSupportModal(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 flex items-center gap-2 px-5 py-3 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-xl border border-black/[0.04] dark:border-white/[0.05] rounded-full text-[13px] font-bold tracking-tight text-slate-700 dark:text-slate-300 hover:text-primary transition-all shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] z-50 cursor-pointer active:scale-95"
      >
        <MessageSquare className="w-4 h-4" />
        Ajuda
      </motion.button>

      {/* Support Modal */}
      <Modal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        title="Contato com o Suporte"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSupportSubmit} className="space-y-6">
          <div className="space-y-2 text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <p className="text-[14px] text-slate-500 dark:text-[#888] font-medium px-4">
              Envie-nos um e-mail descrevendo sua dúvida. Responderemos o mais rápido possível.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-900 dark:text-white px-1">
                Assunto
              </label>
              <input
                type="text"
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                className="input-base"
                placeholder="Do que você precisa ajuda?"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-900 dark:text-white px-1">
                Mensagem
              </label>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                rows={4}
                className="input-base resize-none"
                placeholder="Descreva seu problema com detalhes..."
                required
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSupportModal(false)}
              className="flex-1 justify-center rounded-xl py-3.5 font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 justify-center rounded-xl py-3.5 bg-primary text-white font-bold"
            >
              <Mail className="w-[18px] h-[18px] mr-2" />
              Enviar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
