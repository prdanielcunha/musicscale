import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bug, Lightbulb, MessageSquare, Loader2, Send } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { submitFeedback } from "../../services/feedback";
import { useTranslation } from "react-i18next";

export const FeedbackModal: React.FC<{ isOpen: boolean; onClose: () => void; type?: 'bug' | 'suggestion' | 'feedback' }> = ({ isOpen, onClose, type = 'feedback' }) => {
  const { userProfile } = useAuth();
  const { success, error } = useToast();
  const { t } = useTranslation();
  
  const [feedbackType, setFeedbackType] = useState<'bug' | 'idea' | 'experience'>(type === 'suggestion' ? 'idea' : type === 'bug' ? 'bug' : 'experience');
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await submitFeedback(
        userProfile?.uid,
        userProfile?.organizationId,
        {
          type: feedbackType,
          message,
        }
      );
      
      success(t('feedback.success_sending'), t('feedback.success_details'));
      setMessage("");
      onClose();
    } catch (err) {
      error(t('feedback.error_sending'), t('feedback.error_details'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const types = [
    { id: 'bug', icon: Bug, label: t('feedback.bug') },
    { id: 'idea', icon: Lightbulb, label: t('feedback.idea') },
    { id: 'experience', icon: MessageSquare, label: t('feedback.experience') }
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-0 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg bg-white dark:bg-[#111111] dark:border dark:border-white/10 rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] pointer-events-auto overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="p-6 md:p-8 pb-4">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
                    {t('feedback.title')}
                  </h2>

                  <div className="flex bg-slate-100 dark:bg-white/5 rounded-xl p-1 mb-6">
                    {types.map((t) => {
                      const Icon = t.icon;
                      const isActive = feedbackType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFeedbackType(t.id)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
                            isActive 
                              ? 'bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm' 
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    autoFocus
                    placeholder={
                      feedbackType === 'bug' ? t('feedback.placeholder_bug') :
                      feedbackType === 'idea' ? t('feedback.placeholder_idea') :
                      t('feedback.placeholder_experience')
                    }
                    className="w-full min-h-[140px] resize-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none text-[15px] leading-relaxed"
                  />
                </div>

                <div className="p-4 md:px-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-between items-center text-slate-400 dark:text-slate-500 text-[12px] font-medium">
                  <span className="hidden md:inline">{t('feedback.disclaimer')}</span>
                  <span className="md:hidden"></span>
                  <button
                    type="submit"
                    disabled={!message.trim() || isSubmitting}
                    className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:scale-100 hover:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {t('feedback.submit')} <Send className="w-4 h-4 ml-1 opacity-70" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
