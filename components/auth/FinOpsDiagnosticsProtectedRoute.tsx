import React, { useState } from 'react';
import { useFinOpsDiagnosticsAccess } from '../../hooks/useFinOpsDiagnosticsAccess';
import Spinner from '../common/Spinner';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';

export default function FinOpsDiagnosticsProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, allowed, checked, safeCode, diagnostic } = useFinOpsDiagnosticsAccess();
  const [copied, setCopied] = useState(false);

  if (loading || !checked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#111] text-white">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleCopyDiagnostic = () => {
    if (diagnostic) {
      const textToCopy = `safeCode: ${safeCode}\n` +
        `checkedPath: ${diagnostic.checkedPath}\n` +
        `checkedFields: ${JSON.stringify(diagnostic.checkedFields, null, 2)}\n` +
        `acceptedRoles: ${JSON.stringify(diagnostic.acceptedRoles)}\n` +
        `message: ${diagnostic.message}`;
      
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!allowed) {
    if (safeCode === 'GLOBAL_ROLE_NOT_FOUND' && diagnostic) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#111] text-white p-8 space-y-6">
          <div className="text-center space-y-4 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-white">Acesso global não reconhecido</h2>
            <p className="text-slate-400">O backend não encontrou um papel global canônico para sua conta. Copie o diagnóstico abaixo e envie ao ChatGPT.</p>
            
            <div className="text-left bg-[#1a1a1a] p-4 rounded-md border border-[#333] text-sm text-slate-300 font-mono overflow-auto mt-4 mb-4">
              <pre>
{`safeCode: ${safeCode}
checkedPath: ${diagnostic.checkedPath}
checkedFields: ${JSON.stringify(diagnostic.checkedFields, null, 2)}
acceptedRoles: ${JSON.stringify(diagnostic.acceptedRoles)}
message: ${diagnostic.message}`}
              </pre>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={handleCopyDiagnostic}
                className="flex items-center px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copiar diagnóstico
              </button>
              <Link 
                to="/" 
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors"
              >
                Voltar ao Painel
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#111] text-white p-8 space-y-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">Sem Permissão</h2>
          <p className="text-slate-400">Você não tem acesso global autorizado para visualizar o Diagnóstico FinOps.</p>
        </div>
        <Link 
          to="/" 
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors"
        >
          Voltar ao Painel
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
