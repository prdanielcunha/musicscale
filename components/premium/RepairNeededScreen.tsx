import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ecosystemBridge } from '../../services/ecosystem/EcosystemBridge';
import { AlertTriangle, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const RepairNeededScreen: React.FC = () => {
    const { repairReasons } = useAuth();
    const { t } = useTranslation();

    const handleReturnToMillionsNest = () => {
        ecosystemBridge.navigateToEcosystem('/');
    };

    return (
        <div className="flex bg-[#0a0a0b] dark:bg-[#050505] h-[100dvh] w-[100dvw] justify-center items-center flex-col relative overflow-hidden isolate p-6">
            <div 
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-screen hidden md:block" 
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            ></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-500/10 blur-[100px] rounded-full z-0 hidden md:block"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Contexto Inconsistente</h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Detectamos que a sua conta ou organização atual precisa de ajustes no MillionsNest Hub. Isso pode ocorrer por organizações arquivadas ou permissões incompletas.
                    </p>
                </div>

                {repairReasons && repairReasons.length > 0 && (
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Motivos Identificados</h3>
                        <ul className="space-y-2">
                            {repairReasons.map((reason, idx) => (
                                <li key={idx} className="flex gap-2 items-start text-sm text-slate-300">
                                    <span className="text-red-500 mt-1">•</span>
                                    <span>{reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="pt-4 flex flex-col gap-3 w-full">
                    <button 
                        onClick={handleReturnToMillionsNest}
                        className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all active:scale-95"
                    >
                        <Home className="w-5 h-5" />
                        Retornar ao Hub (Diagnóstico)
                    </button>
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest">
                        O MillionsNest corrigirá os problemas automaticamente
                    </p>
                </div>
            </div>
        </div>
    );
};
