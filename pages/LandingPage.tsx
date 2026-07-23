import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    CheckCircle2, 
    Play, 
    Star, 
    XCircle, 
    ChevronDown, 
    Music, 
    Smartphone, 
    ListMusic, 
    Settings2 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
    const [isAnnual, setIsAnnual] = useState(true);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    const toggleFaq = (index: number) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    const painPoints = [
        { pain: "Planilhas confusas", solution: "Escalas Automáticas" },
        { pain: "PDF de cifras perdidos", solution: "Banco Master no Celular" },
        { pain: "Grupos de WhatsApp lotados", solution: "Notificações Integradas" },
        { pain: "Tom errado no ensaio", solution: "Transposição Inteligente" }
    ];

    const faqs = [
        {
            question: "Preciso cadastrar cartão agora?",
            answer: "Não! O teste de 7 dias é totalmente gratuito e não exige cartão de crédito. Você só assina se realmente amar a plataforma."
        },
        {
            question: "E se eu já tiver minhas músicas?",
            answer: "Você pode importar suas músicas facilmente ou usar nosso banco inteligente para buscar letras e cifras com um clique."
        },
        {
            question: "Funciona no celular na hora do culto?",
            answer: "Sim! Nossa interface foi desenhada no modelo mobile-first. Suas cifras e escalas abrem perfeitamente em qualquer smartphone ou tablet, mesmo com internet fraca."
        },
        {
            question: "Como cancelo?",
            answer: "Você pode cancelar a qualquer momento direto pelo painel, sem taxas escondidas ou multas. Simples e transparente."
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* 1. Header/Navbar */}
            <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-[#050505]/70 border-b border-slate-200 dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Music className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight">MillionsNest</span>
                    </div>
                    
                    <nav className="hidden md:flex gap-8">
                        <a href="#funcionalidades" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Funcionalidades</a>
                        <a href="#precos" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Preços</a>
                        <a href="#duvidas" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Dúvidas</a>
                    </nav>

                    <div className="flex items-center">
                        <a href="https://app.millionsnest.com/registro" className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25">
                            Teste Grátis por 7 Dias
                        </a>
                        <button className="sm:hidden p-2 text-slate-600 dark:text-slate-400">
                            <Music className="w-6 h-6" /> {/* Placeholder for mobile menu icon */}
                        </button>
                    </div>
                </div>
            </header>

            <main>
                {/* 2. Hero Section */}
                <section className="relative pt-24 pb-32 overflow-hidden">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-white to-white dark:from-indigo-900/20 dark:via-[#050505] dark:to-[#050505]"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-slate-900 dark:text-white"
                        >
                            Organize seu Ministério de <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-indigo-400 dark:to-yellow-500">
                                Louvor em Minutos, Não em Horas.
                            </span>
                        </motion.h1>

                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed"
                        >
                            Chega de escalas no WhatsApp e cifras perdidas. A ferramenta definitiva para conectar músicos, organizar repertórios e focar no que importa: a adoração.
                        </motion.p>

                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
                        >
                            <a href="https://app.millionsnest.com/registro" className="w-full sm:w-auto px-8 py-4 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/30 flex items-center justify-center relative overflow-hidden group">
                                <span className="relative z-10">Começar Teste Grátis de 7 Dias</span>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                            </a>
                            <button className="w-full sm:w-auto px-8 py-4 text-base font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                                <Play className="w-4 h-4" />
                                Ver Demonstração
                            </button>
                        </motion.div>

                        {/* VSL Mockup */}
                        <motion.div 
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="relative max-w-5xl mx-auto rounded-2xl md:rounded-[2rem] p-2 bg-slate-200/50 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl"
                        >
                            <div className="aspect-video bg-slate-900 rounded-xl md:rounded-[1.5rem] overflow-hidden relative flex items-center justify-center group cursor-pointer shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600/90 transition-all duration-300 shadow-lg border border-white/20">
                                    <Play className="w-8 h-8 text-white ml-1" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* 3. Social Proof */}
                <section className="py-12 border-y border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                        <div className="flex gap-1 mb-4 text-yellow-500">
                            {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-5 h-5 fill-current" />)}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium text-center">
                            "Junte-se a dezenas de líderes que já simplificaram suas rotinas."
                        </p>
                    </div>
                </section>

                {/* 4. Agitação da Dor */}
                <section className="py-24 bg-white dark:bg-[#050505]">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-16">
                            Você não foi chamado para ser <span className="text-indigo-600 dark:text-indigo-400">administrador de planilha.</span>
                        </h2>
                        
                        <div className="grid sm:grid-cols-2 gap-6">
                            {painPoints.map((item, index) => (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    key={index} 
                                    className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex flex-col gap-4 text-left hover:border-indigo-500/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
                                        <XCircle className="w-5 h-5 shrink-0" />
                                        <span className="line-through opacity-70 font-medium">{item.pain}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                                        <span className="font-semibold text-slate-900 dark:text-white">{item.solution}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. Funcionalidades (Bento Grid) */}
                <section id="funcionalidades" className="py-24 bg-slate-50 dark:bg-[#0a0a0b]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo o que você precisa, <br className="hidden sm:block"/>em um só lugar.</h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Nossa plataforma foi desenhada para resolver os problemas reais de quem lidera o louvor todo final de semana.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
                            {/* Card Grande */}
                            <motion.div 
                                whileHover={{ y: -5 }}
                                className="md:col-span-2 md:row-span-2 rounded-3xl p-8 bg-gradient-to-br from-indigo-500 to-violet-600 text-white overflow-hidden relative shadow-lg"
                            >
                                <div className="relative z-10">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md mb-6">
                                        <Settings2 className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">Gestão de Escalas com Notificação</h3>
                                    <p className="text-indigo-100 max-w-md">Monte a escala do mês em minutos. A plataforma notifica automaticamente cada músico sobre seus dias e repertórios.</p>
                                </div>
                                <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-white/10 backdrop-blur-xl rounded-tl-2xl translate-x-12 translate-y-12 border-t border-l border-white/20 p-4">
                                    {/* Abstract UI representation */}
                                    <div className="w-full h-8 bg-white/20 rounded-md mb-3"></div>
                                    <div className="w-3/4 h-8 bg-white/20 rounded-md mb-3"></div>
                                    <div className="w-5/6 h-8 bg-white/20 rounded-md"></div>
                                </div>
                            </motion.div>

                            {/* Card Médio */}
                            <motion.div 
                                whileHover={{ y: -5 }}
                                className="md:col-span-1 md:row-span-2 rounded-3xl p-8 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col"
                            >
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-6 shrink-0">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Visualizador Mobile-First</h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-8 flex-1">Cifras e letras que se adaptam perfeitamente à tela do celular, sem precisar de zoom.</p>
                                <div className="w-full aspect-[9/16] bg-slate-100 dark:bg-white/5 rounded-t-2xl border-x border-t border-slate-200 dark:border-white/10 mt-auto translate-y-8 relative">
                                     <div className="absolute top-4 left-4 right-4 h-4 bg-slate-200 dark:bg-white/10 rounded-full w-1/2"></div>
                                     <div className="absolute top-12 left-4 right-4 h-2 bg-slate-200 dark:bg-white/10 rounded-full w-3/4"></div>
                                     <div className="absolute top-16 left-4 right-4 h-2 bg-slate-200 dark:bg-white/10 rounded-full w-full"></div>
                                     <div className="absolute top-20 left-4 right-4 h-2 bg-slate-200 dark:bg-white/10 rounded-full w-5/6"></div>
                                </div>
                            </motion.div>

                            {/* Card Pequeno 1 */}
                            <motion.div 
                                whileHover={{ y: -5 }}
                                className="md:col-span-1 md:row-span-1 rounded-3xl p-8 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-sm"
                            >
                                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center mb-4">
                                    <Music className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Transposição em 1 Clique</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Mude o tom da cifra instantaneamente para se adaptar a quem vai ministrar.</p>
                            </motion.div>

                            {/* Card Pequeno 2 */}
                            <motion.div 
                                whileHover={{ y: -5 }}
                                className="md:col-span-2 md:row-span-1 rounded-3xl p-8 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-center"
                            >
                                <div className="flex items-start gap-6">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0">
                                        <ListMusic className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold mb-2">Playlists e Repertórios</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">Organize os blocos de louvor, anexe links do YouTube/Spotify e mantenha a banda alinhada.</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* 6. Pricing */}
                <section id="precos" className="py-24 bg-white dark:bg-[#050505]">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Preço simples, para ministérios.</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-10">Desbloqueie todo o potencial da sua equipe sem planos confusos.</p>
                        
                        {/* Toggle */}
                        <div className="flex items-center justify-center gap-4 mb-12">
                            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Mensal</span>
                            <button 
                                onClick={() => setIsAnnual(!isAnnual)}
                                className="w-14 h-7 bg-indigo-600 rounded-full relative transition-colors focus:outline-none"
                            >
                                <motion.div 
                                    className="w-5 h-5 bg-white rounded-full absolute top-1 shadow-sm"
                                    animate={{ left: isAnnual ? '32px' : '4px' }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                            <span className={`text-sm font-medium flex items-center gap-2 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                Anual <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">2 meses grátis</span>
                            </span>
                        </div>

                        {/* Pricing Card */}
                        <div className="relative p-8 md:p-12 rounded-[2rem] bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-xl max-w-lg mx-auto text-left">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-[2rem]"></div>
                            
                            <h3 className="text-2xl font-bold mb-2">Plano Ministério</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Acesso completo para você e sua equipe.</p>
                            
                            <div className="mb-8">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold">R$ {isAnnual ? '197,00' : '19,90'}</span>
                                    <span className="text-slate-500 font-medium">/{isAnnual ? 'ano' : 'mês'}</span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {[
                                    "Membros ilimitados",
                                    "Músicas e cifras ilimitadas",
                                    "App completo no Celular",
                                    "Transposição de tom",
                                    "Notificações automáticas"
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <span className="text-sm font-medium">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <a href="https://app.millionsnest.com/registro" className="block w-full py-4 text-center text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                                Começar 7 Dias Grátis
                            </a>
                            <p className="text-xs text-center text-slate-500 mt-4">Sem compromisso. Não requer cartão de crédito para testar.</p>
                        </div>

                        {/* Upsell Section */}
                        <div className="mt-12 p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-left flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h4 className="text-lg font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2 mb-1">
                                    <Star className="w-4 h-4 fill-current" /> Acelerador de Ministérios
                                </h4>
                                <p className="text-sm text-amber-800/80 dark:text-amber-400/80">Adicione o <strong>Master Pack com 500 Cifras Prontas</strong> e economize meses de digitação. Pagamento único.</p>
                            </div>
                            <button className="whitespace-nowrap px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                                Ver Detalhes
                            </button>
                        </div>
                    </div>
                </section>

                {/* 7. FAQ */}
                <section id="duvidas" className="py-24 bg-slate-50 dark:bg-[#0a0a0b]">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-center mb-12">Perguntas Frequentes</h2>
                        
                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111] overflow-hidden transition-colors hover:border-indigo-500/30">
                                    <button 
                                        onClick={() => toggleFaq(index)}
                                        className="w-full px-6 py-5 text-left flex items-center justify-between focus:outline-none"
                                    >
                                        <span className="font-semibold">{faq.question}</span>
                                        <motion.div
                                            animate={{ rotate: activeFaq === index ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence>
                                        {activeFaq === index && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 pb-5 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                                    {faq.answer}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* 8. Footer */}
            <footer className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#050505] py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Music className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold tracking-tight">MillionsNest</span>
                    </div>
                    
                    <p className="text-sm text-slate-500">Criando soluções para líderes.</p>
                    
                    <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Termos de Uso</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacidade</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contato</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
