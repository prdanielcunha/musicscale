import fs from 'fs';

let code = fs.readFileSync('components/billing/UserUsageBanner.tsx', 'utf8');

if (!code.includes('useTranslation')) {
    code = code.replace(/import \{ .* \} from 'lucide-react';/, "$&\nimport { useTranslation } from 'react-i18next';");
}
code = code.replace(/export function UserUsageBanner\(\) \{/g, 'export function UserUsageBanner() {\n  const { t } = useTranslation();');

code = code.replace(/>Usuários Ilimitados liberados</g, '>{t("billing.unlimited_users", "Usuários Ilimitados liberados")}<');
code = code.replace(/>\s*Convide toda a banda. Não há limite de membros no Pro.\s*</g, '>{t("billing.invite_team", "Convide toda a banda. Não há limite de membros no Pro.")}<');

code = code.replace(/\{usedUsers\} de \{userLimit\} usuários no plano/g, '{t("billing.users_in_plan", "{{used}} de {{limit}} usuários no plano", { used: usedUsers, limit: userLimit })}');
code = code.replace(/Plano lotado\. Faça upgrade hoje para convidar mais membros e desbloquear recursos premium\./g, '{t("billing.plan_full", "Plano lotado. Faça upgrade hoje para convidar mais membros e desbloquear recursos premium.")}');
code = code.replace(/\{userLimit - usedUsers\} \{userLimit - usedUsers === 1 \? 'vaga restante' : 'vagas restantes'\}\./g, '{t("billing.spots_left", "{{count}} vaga restante", { count: userLimit - usedUsers })}');
code = code.replace(/>Ver Planos</g, '>{t("billing.view_plans", "Ver Planos")}<');
code = code.replace(/>Fazer Upgrade</g, '>{t("billing.upgrade", "Fazer Upgrade")}<');

fs.writeFileSync('components/billing/UserUsageBanner.tsx', code);
