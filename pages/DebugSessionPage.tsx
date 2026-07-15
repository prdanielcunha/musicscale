import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

import { getSubscriptionBlockReason } from "../utils/subscriptionValidator";

const DebugSessionPage: React.FC = () => {
    const { 
        user, 
        userProfile, 
        organization, 
        subscription, 
        permissions, 
        isAdmin, 
        isOwner, 
        entitlements
    } = useAuth();
    
    const contextValidation = React.useMemo(() => ({
      entitlements,
      organization,
      subscription
    }), [entitlements, organization, subscription]);

    const { valid: isSubValid, reason: subReason, banner: subBanner } = getSubscriptionBlockReason(contextValidation);

    const [lastSyncLog, setLastSyncLog] = useState<any>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("debug_last_sync");
            if (raw) {
                setLastSyncLog(JSON.parse(raw));
            }
        } catch (e) {
            console.error("Failed to parse last sync log", e);
        }
    }, []);

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white pb-1">
                    Debug Session
                </h1>
                <p className="text-slate-500 text-sm">
                    Painel interno de observabilidade e verificações do ecossistema MillionsNest.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Identity & Organization</h2>
                    <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li><strong>UID:</strong> {user?.uid || "N/A"}</li>
                        <li><strong>Email:</strong> {user?.email || "N/A"}</li>
                        <li><strong>Profile Name:</strong> {userProfile?.displayName || "N/A"}</li>
                        <li><strong>System Role (MillionsNest):</strong> {userProfile?.systemRole || "N/A"}</li>
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <li><strong>Organization ID:</strong> {userProfile?.organizationId || "N/A"}</li>
                        <li><strong>Inst. Name:</strong> {organization?.name || "N/A"}</li>
                        <li><strong>Owner User ID:</strong> {organization?.ownerUserId || "N/A"}</li>
                        <li><strong>OrgRole (Normalized):</strong> {(userProfile?.organizationRole || userProfile?.role || 'member')}</li>
                        <li><strong>OrgRole (Raw):</strong> {userProfile?.organizationRole || "N/A"}</li>
                        <li><strong>AppRole / Role ID:</strong> {userProfile?.appRole || userProfile?.roleId || "N/A"}</li>
                        <li><strong>Is Org Owner:</strong> {isOwner ? "Sim" : "Não"}</li>
                    </ul>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Subscription Sync</h2>
                    <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li><strong>Status:</strong> {subscription?.status || organization?.subscriptionStatus || "N/A"} {['active', 'trialing', 'trial', 'pro'].includes(subscription?.status || '') && '✅'}</li>
                        <li><strong>Plan Level:</strong> {subscription?.plan || organization?.subscriptionPlan || organization?.plan || "N/A"}</li>
                        <li><strong>Current Period End:</strong> {entitlements?.currentPeriodEnd || (subscription as any)?.currentPeriodEnd || "N/A"}</li>
                        <li><strong>Is Valid Logic:</strong> {isSubValid ? 'Sim ✅' : 'Não ❌'}</li>
                        <li><strong>Block Reason:</strong> {subReason || 'N/A'}</li>
                        <li><strong>Stripe Customer:</strong> {(organization as any)?.stripeCustomerId || (organization as any)?.stripe_customer_id || "N/A"}</li>
                        <li><strong>Stripe Subs ID:</strong> {(organization as any)?.stripeSubscriptionId || (organization as any)?.stripe_subscription_id || "N/A"}</li>
                    </ul>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm md:col-span-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Realtime App Permissions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.entries(permissions || {}).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5">
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{key}</span>
                                <span className={`text-xs font-bold ${value ? 'text-emerald-500' : 'text-rose-500'}`}>{value ? 'TRUE' : 'FALSE'}</span>
                            </div>
                        ))}
                    </div>
                    {Object.keys(permissions || {}).length === 0 && (
                        <p className="text-sm text-slate-500 opacity-70 italic">Nenhuma permissão específica mapeada (Empty Object).</p>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm md:col-span-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Latest Sync Diagnostics</h2>
                    {lastSyncLog ? (
                         <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 font-mono text-xs">
                             <li><strong>Endpoint Called:</strong> {lastSyncLog.endpoint}</li>
                             <li><strong>Date executed:</strong> {new Date(lastSyncLog.date).toLocaleString()}</li>
                             <li><strong>Final Status:</strong> <span className={lastSyncLog.success ? 'text-emerald-500' : 'text-rose-500'}>{lastSyncLog.status}</span></li>
                             {lastSyncLog.error && <li className="text-rose-500 mt-2 p-2 bg-rose-500/10 rounded-lg whitespace-pre-wrap">{lastSyncLog.error}</li>}
                         </ul>
                    ) : (
                         <p className="text-sm text-slate-500 opacity-70 italic">Nenhum log de sync encontrado no localStorage.</p>
                    )}
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm md:col-span-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Raw Objects (JSON)</h2>
                    <details className="mb-2">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">User Profile</summary>
                        <pre className="mt-2 text-xs overflow-x-auto p-3 bg-slate-950 text-emerald-400 rounded-xl leading-relaxed">
                            {JSON.stringify(userProfile, null, 2)}
                        </pre>
                    </details>
                    <details className="mb-2">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">Organization</summary>
                        <pre className="mt-2 text-xs overflow-x-auto p-3 bg-slate-950 text-emerald-400 rounded-xl leading-relaxed">
                            {JSON.stringify(organization, null, 2)}
                        </pre>
                    </details>
                    <details>
                        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">Subscription</summary>
                        <pre className="mt-2 text-xs overflow-x-auto p-3 bg-slate-950 text-emerald-400 rounded-xl leading-relaxed">
                            {JSON.stringify(subscription, null, 2)}
                        </pre>
                    </details>
                </div>
            </div>
        </div>
    );
};

export default DebugSessionPage;
