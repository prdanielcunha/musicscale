import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { AlertTriangleIcon } from "../icons/AlertTriangleIcon";
import Spinner from "./Spinner";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isLoading: boolean;
  error: string | null;
}

const formInputClass = "mt-1 input-base";

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  error,
}) => {
  const [confirmationText, setConfirmationText] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Reset form when modal opens or closes
    if (!isOpen) {
      setTimeout(() => {
        setConfirmationText("");
        setPassword("");
      }, 300); // Delay reset to allow for closing animation
    }
  }, [isOpen]);

  const canSubmit =
    confirmationText === "Excluir" && password.length > 0 && !isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onConfirm(password);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Excluir Conta Permanentemente?"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-start space-x-4">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangleIcon className="h-6 w-6 text-red-500" />
          </div>
          <div className="mt-0 text-left space-y-4">
            <p className="text-base text-gray-300">
              Esta ação é irreversível. Todos os seus dados serão apagados para
              sempre. Para confirmar, digite <strong>Excluir</strong> no campo
              abaixo e insira sua senha.
            </p>
            <div>
              <label
                htmlFor="confirmationText"
                className="block text-sm font-medium text-slate-400"
              >
                Confirmar Ação
              </label>
              <input
                type="text"
                id="confirmationText"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className={formInputClass}
                placeholder="Excluir"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-400"
              >
                Sua Senha
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={formInputClass}
                placeholder="Para sua segurança, confirme sua senha"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>
        <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
          <Button
            type="submit"
            variant="danger"
            disabled={!canSubmit}
            className="w-full sm:ml-3 sm:w-auto"
          >
            {isLoading ? <Spinner size="sm" /> : "Excluir minha conta"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="mt-3 w-full sm:mt-0 sm:w-auto"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default DeleteAccountModal;
