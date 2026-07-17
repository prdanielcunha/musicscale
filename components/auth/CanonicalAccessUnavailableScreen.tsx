import React from 'react';
import { useEcosystem } from '../../contexts/EcosystemContext';

export const CanonicalAccessUnavailableScreen: React.FC = () => {
    const { retryAccessContext, correlationId, safeErrorCode, isDegraded } = useEcosystem();
    const [showDiag, setShowDiag] = React.useState(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#000000] text-slate-100 p-6 font-sans">
            <div className="max-w-md w-full bg-[#111111] p-8 rounded-2xl border border-slate-800/50 shadow-2xl flex flex-col items-center text-center space-y-6">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                
                <h2 className="text-xl font-semibold tracking-tight">Não foi possível carregar seus acessos</h2>
                
                <p className="text-sm text-slate-400 leading-relaxed">
                    O preview não conseguiu validar suas permissões com o servidor do MusicScale. Seus dados continuam protegidos.
                </p>

                <div className="w-full space-y-3 pt-4">
                    <button 
                        onClick={retryAccessContext}
                        className="w-full bg-slate-100 hover:bg-white text-black font-medium py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-[#111111]"
                    >
                        Tentar novamente
                    </button>
                    
                    <button 
                        onClick={() => setShowDiag(!showDiag)}
                        className="w-full bg-transparent hover:bg-slate-800/50 text-slate-300 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                    >
                        Ver diagnóstico
                    </button>
                </div>

                {showDiag && (
                    <div className="w-full mt-4 p-4 bg-[#0a0a0a] rounded-lg border border-slate-800/50 text-left space-y-2">
                        <p className="text-xs text-slate-500 flex justify-between">
                            <span>Status:</span> <span className="font-mono text-slate-300">Indisponível</span>
                        </p>
                        <p className="text-xs text-slate-500 flex justify-between">
                            <span>Código Seguro:</span> <span className="font-mono text-slate-300">{safeErrorCode || 'TIMEOUT'}</span>
                        </p>
                        <p className="text-xs text-slate-500 flex flex-col gap-1">
                            <span>Correlation ID:</span> 
                            <span className="font-mono text-slate-300 text-[10px] break-all">{correlationId || 'N/A'}</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
