import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("bandScalesPage.manageFixedScales", "Gerenciar Escalas Fixas")}
      maxWidth="max-w-4xl"
      zIndexClass="z-[10030]"
    >
      <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400 -mt-2 mb-4">
        {t(
          "bandScalesPage.manageFixedScalesDescription",
          "Crie e mantenha as formações fixas da banda. Ao montar uma Escala de Músicas, você seleciona uma delas para o evento; notificações e confirmações acontecem na própria Escala de Músicas.",
        )}
      </p>
      <FixedBandScaleManager />
    </Modal>
  );
};

export default FixedBandScaleManagerModal;
