const fs = require('fs');
let content = fs.readFileSync('hooks/useStarterPackAllowance.ts', 'utf8');

content = content.replace(
  "const response = await fetch('/api/v1/onboarding/starter-pack/status', {",
  "const response = await fetch('/api/v1/onboarding/starter-pack', {"
);

const originalErrorLogic = `      if (data.success && data.allowance) {
        setAllowance(data.allowance);
        setError(null);
      } else {
        throw new Error('Formato de resposta inválido');
      }`;

const newErrorLogic = `      if (data.success && data.allowance) {
        setAllowance(data.allowance);
        setError(null);
      } else if (!data.allowance) {
        setError({
          message: 'Estamos atualizando o acesso ao pacote inicial. Tente novamente em instantes.',
          code: 'BACKEND_ALLOWANCE_CONTRACT_UNAVAILABLE'
        });
        setAllowance(null);
        setLoading(false);
      } else {
        throw new Error('Formato de resposta inválido');
      }`;

content = content.replace(originalErrorLogic, newErrorLogic);
fs.writeFileSync('hooks/useStarterPackAllowance.ts', content, 'utf8');
