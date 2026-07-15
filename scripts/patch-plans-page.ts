import fs from 'fs';

let code = fs.readFileSync('pages/PlansPage.tsx', 'utf8');

code = code.replace(/>Configurações de Licença</g, '>{t("plans.license_config", "Configurações de Licença")}<');
code = code.replace(/>Planos e Limites do Ministério</g, '>{t("plans.title", "Planos e Limites do Ministério")}<');
code = code.replace(/Sua assinatura e faturamento são gerenciados centralizadamente pela plataforma <strong>MillionsNest<\/strong>, garantindo total conformidade, segurança e facilidade nos pagamentos\./g, '{t("plans.subtitle", "Sua assinatura e faturamento são gerenciados centralizadamente pela plataforma MillionsNest, garantindo total conformidade, segurança e facilidade nos pagamentos.")}');
code = code.replace(/>Licenciamento Ativo</g, '>{t("plans.active_license", "Licenciamento Ativo")}<');

fs.writeFileSync('pages/PlansPage.tsx', code);
