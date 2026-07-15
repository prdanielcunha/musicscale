import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Card from "../common/Card";
import { BugIcon } from "../icons/BugIcon";
import { MessageSquareQuestionIcon } from "../icons/MessageSquareQuestionIcon";
import { BookTextIcon } from "../icons/BookTextIcon";
import { InfoIcon } from "../icons/InfoIcon";
import { GitBranchIcon } from "../icons/GitBranchIcon";
import { useTranslation } from "react-i18next";

interface HelpModalProps {
  isOpen: boolean;
  initialSection: string | null;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  initialSection,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "pt";
  const [activeTab, setActiveTab] = useState("report");

  useEffect(() => {
    if (initialSection) {
      setActiveTab(initialSection);
    }
  }, [initialSection]);

  const tabs = [
    {
      id: "report",
      label: t("help_modal.tab_report"),
      icon: <BugIcon className="w-5 h-5" />,
    },
    {
      id: "faq",
      label: t("help_modal.tab_faq"),
      icon: <MessageSquareQuestionIcon className="w-5 h-5" />,
    },
    {
      id: "tutorial",
      label: t("help_modal.tab_tutorial"),
      icon: <BookTextIcon className="w-5 h-5" />,
    },
    { id: "about", label: t("help_modal.tab_about"), icon: <InfoIcon className="w-5 h-5" /> },
    {
      id: "version",
      label: t("help_modal.tab_version"),
      icon: <GitBranchIcon className="w-5 h-5" />,
    },
  ];

  const faqs = [
    {
      q: t("help_modal.faq_1_q", "O que é a Biblioteca Viva?"),
      a: t("help_modal.faq_1_a", "A Biblioteca Viva é um banco integrado de músicas padronizadas. Em vez de adicionar músicas manualmente, você pode buscar no nosso repositório curado, que já conta com letras, links de cifras e métricas (como BPM), economizando muito tempo na montagem do repertório.")
    },
    {
      q: t("help_modal.faq_2_q", "Como uso o Performance Mode (Visualizador de Cifras)?"),
      a: t("help_modal.faq_2_a", "Dentro de uma escala de música ou diretamente no repertório, se a música possuir uma cifra cadastrada, aparecerá a opção para abrir o Visualizador. Ele ajusta o contraste, formata os acordes em cima da letra e permite Transposição de tonalidade ao vivo, tudo com animações suaves e ótimo contraste.")
    },
    {
      q: t("help_modal.faq_3_q", "Como crio uma escala de músicas para o culto?"),
      a: t("help_modal.faq_3_a", 'Vá para "Escalas" > "Músicas". Clique em "Nova Escala de Música". Preencha informações do evento (data, local) e puxe músicas do repertório da sua equipe. Você pode conectar links do YouTube/Spotify para estudo e revisar as cifras para o dia.')
    },
    {
      q: t("help_modal.faq_4_q", "Como faço a integração da banda com a escala de músicas?"),
      a: t("help_modal.faq_4_a", 'Primeiro, crie a Escala de Músicas. Em seguida, crie uma "Escala da Banda" para o mesmo evento/data escalando seus instrumentistas e vocais. O sistema permite vincular ambas para que todos tenham acesso ao repertório e cifras do dia com um só clique.')
    },
    {
      q: t("help_modal.faq_5_q", "O acesso de um membro expirou ou mostra 'Inconsistência Detectada'. O que fazer?"),
      a: t("help_modal.faq_5_a", "O app é integrado à plataforma MillionsNest. Se a assinatura do ministério expirar no Nest, os líderes ou administradores precisam renovar lá. O app realiza o reparo automático (gateway inteligente) caso a assinatura seja reativada, resincronizando todo o time perfeitamente.")
    }
  ];

  const tutorials = [
    {
      title: t("help_modal.tutorial_1_title", "Biblioteca e Repertório Local"),
      content: t("help_modal.tutorial_1_content", 'Recomendamos iniciar pesquisando canções na "Biblioteca Viva". Quando você adiciona ela ao seu Pátio Local (seu repositório), ela já vem com tom original, métrica e links. A partir daí, basta montar seu setlist para os eventos com a certeza de que todos estão estudando a mesma versão.')
    },
    {
      title: t("help_modal.tutorial_2_title", "Ensaio e Palco: Performance Mode"),
      content: t("help_modal.tutorial_2_content", 'Para líderes, cantores e músicos que cantam tocando: o app conta com o Performance Mode. Uma tela preta desenhada especialmente para uso em culto/palco, com rolagem limpa, e as cifras formatadas em tempo real. Precisa alterar o tom de última hora? Os botões de transposição na tela ajustam o tom suavemente sem precisar recarregar nada.')
    },
    {
      title: t("help_modal.tutorial_3_title", "Gestão Organizacional (Multi-Tenant)"),
      content: t("help_modal.tutorial_3_content", 'Administradores gerenciam a equipe. Todo membro convidado para a sua Organização no Music Scale recebe acesso enquanto a assinatura do Ministério estiver ativa. O sistema define o nível de cada um (Admin, Líder, Músico), limitando edições de escalas apenas para quem deve fazê-las, protegendo seus dados.')
    }
  ];

  const mailtoHref = `mailto:pastordanielpcunha@gmail.com?subject=${encodeURIComponent(
    currentLang === "es"
      ? "Reporte de Error / Comentarios - MusicScale"
      : currentLang === "en"
        ? "Bug Report / Feedback - MusicScale"
        : "Reporte de Erro / Feedback - Music Scale Manager"
  )}&body=${encodeURIComponent(
    currentLang === "es"
      ? "[Describa el inconveniente o sugerencia aquí. Si se trata de un error, por favor incluya los pasos para reproducirlo.]"
      : currentLang === "en"
        ? "[Describe the bug or feedback here. If it is an error, please include replication steps.]"
        : "[Descreva o problema ou sugestão aqui. Se for um erro, por favor, inclua os passos para reproduzi-lo.]"
  )}`;

  const renderContent = () => {
    switch (activeTab) {
      case "report":
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {t("help_modal.report_title")}
            </h2>
            <p className="text-slate-600 dark:text-gray-300 mb-6">
              {t("help_modal.report_desc")}
            </p>
            <Button
              as="a"
              href={mailtoHref}
              leftIcon={<BugIcon className="w-4 h-4" />}
            >
              {t("help_modal.report_btn")}
            </Button>
          </div>
        );
      case "faq":
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              {t("help_modal.tab_faq")}
            </h2>
            <div className="space-y-4">
              {faqs.map((item, index) => (
                <details
                  key={index}
                  className="p-4 bg-slate-100 dark:bg-gray-700/50 rounded-lg group"
                >
                  <summary className="font-semibold text-slate-700 dark:text-gray-200 cursor-pointer list-none flex justify-between items-center">
                    {item.q}
                    <svg
                      className="w-5 h-5 text-slate-500 group-open:rotate-90 transition-transform"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </summary>
                  <p className="mt-2 text-slate-600 dark:text-gray-300">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        );
      case "tutorial":
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              {t("help_modal.tab_tutorial")}
            </h2>
            <div className="space-y-4">
              {tutorials.map((item, index) => (
                <Card key={index} className="p-4">
                  <h3 className="font-bold text-primary dark:text-primary-light">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-slate-600 dark:text-gray-300">
                    {item.content}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        );
      case "version":
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              {t("help_modal.version_title")}
            </h2>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-600 dark:text-gray-300">
                    {t("help_modal.version_app")}
                  </span>
                  <span className="font-bold text-lg text-primary dark:text-primary-light">
                    1.0
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-600 dark:text-gray-300">
                    {t("help_modal.version_date_label")}
                  </span>
                  <span className="text-slate-800 dark:text-white">
                    {t("help_modal.version_date_val")}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-gray-700">
                  <h4 className="font-semibold text-slate-600 dark:text-gray-300 mb-2">
                    {t("help_modal.version_news_title")}
                  </h4>
                  <ul className="list-disc list-inside text-slate-600 dark:text-gray-300 space-y-1 text-sm">
                    <li>{t("help_modal.version_news_li1")}</li>
                    <li>{t("help_modal.version_news_li2")}</li>
                    <li>{t("help_modal.version_news_li3")}</li>
                    <li>{t("help_modal.version_news_li4")}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        );
      case "about":
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              {t("help_modal.about_title")}
            </h2>
            <div className="space-y-4 text-slate-600 dark:text-gray-300 text-base leading-relaxed">
              <p dangerouslySetInnerHTML={{ __html: t("help_modal.about_p1") }} />
              <p>{t("help_modal.about_p2")}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("help_modal.title")}
      maxWidth="max-w-5xl"
      noPadding
    >
      <div className="flex flex-col md:flex-row h-[70vh]">
        <nav className="flex-shrink-0 md:w-56 p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-gray-700">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 p-3 text-sm font-semibold rounded-lg text-left transition-colors ${activeTab === tab.id ? "bg-primary/10 text-primary-dark dark:text-primary-light" : "text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800"}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6 overflow-y-auto">{renderContent()}</main>
      </div>
    </Modal>
  );
};

export default HelpModal;
