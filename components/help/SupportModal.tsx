import { logger } from "../../lib/logger";

import React, { useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const response = await fetch("/api/support/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          subject,
          message,
        }),
      });

      if (response.ok) {
        setSent(true);
        setTimeout(() => {
          onClose();
          setSent(false);
          setSubject("");
          setMessage("");
        }, 3000);
      }
    } catch (error) {
      logger.error("Error sending support email:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Suporte ao MusicScale"
      maxWidth="max-w-md"
    >
      <div className="p-1">
        {sent ? (
          <div className="py-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              E-mail Enviado!
            </h3>
            <p className="text-slate-500 dark:text-gray-400">
              Recebemos sua mensagem e responderemos em breve em seu e-mail.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Olá! Conte-nos como podemos te ajudar. Responderemos para o
              e-mail:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {userEmail}
              </span>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                Assunto
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-100 dark:bg-gray-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary transition-all"
                placeholder="Dúvida, erro, sugestão..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                Mensagem
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-base resize-none !h-auto min-h-[120px]"
                placeholder="Descreva aqui o que está acontecendo..."
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full py-4 shadow-lg shadow-primary/25"
                disabled={isSending}
              >
                {isSending ? (
                  <Spinner size="sm" />
                ) : (
                  "Enviar E-mail para Suporte"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default SupportModal;
