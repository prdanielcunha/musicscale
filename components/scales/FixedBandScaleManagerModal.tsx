import React from "react";
import Modal from "../common/Modal";
import FixedBandScaleManager from "../database/FixedBandScaleManager";

interface FixedBandScaleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FixedBandScaleManagerModal: React.FC<FixedBandScaleManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerenciar Escalas Fixas"
      maxWidth="max-w-4xl"
    >
      <p className="text-sm text-slate-500 dark:text-gray-400 -mt-2 mb-4">
        Crie modelos de bandas que podem ser rapidamente aplicados ao criar uma
        nova escala de banda.
      </p>
      <FixedBandScaleManager />
    </Modal>
  );
};

export default FixedBandScaleManagerModal;
