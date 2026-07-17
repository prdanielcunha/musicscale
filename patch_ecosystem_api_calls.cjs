const fs = require('fs');
let file = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

const regexToReplace = /if \(apiRes && apiRes\.ok\) \{[\s\S]*?console\.warn\("\[EcosystemContext\] Server-resolved access context HTTP error:", apiRes\?\.status\);\s*\}/;

file = file.replace(regexToReplace, 
`if (apiRes) {
    if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (isValidCanonicalResponse(resJson, user.uid, orgId)) {
            serverContext = resJson;
            systemRole = resJson.systemRole || systemRole;
            roleInOrg = resJson.organizationRole || roleInOrg;
            setAccessContextStatus('resolved');
            console.log(\`[EcosystemContext] Canonical server-resolved access:\`, resJson);
            markStartupMetric('ecosystem_access_context_completed_ms');
        } else {
            console.warn("[EcosystemContext] Canonical response was invalid match.");
            setAccessContextStatus('invalid_response');
        }
    } else {
        const errJson = await apiRes.json().catch(() => ({}));
        setSafeErrorCode(errJson.safeErrorCode || 'HTTP_' + apiRes.status);
        setCorrelationId(errJson.correlationId);
        if (apiRes.status === 401 || apiRes.status === 403) {
            setAccessContextStatus('access_denied');
        } else if (apiRes.status === 503) {
            setAccessContextStatus('infrastructure_unavailable');
        } else if (apiRes.status === 404) {
            setAccessContextStatus('access_denied');
        } else {
            setAccessContextStatus('invalid_response');
        }
        console.warn("[EcosystemContext] Server-resolved access context HTTP error:", apiRes.status);
    }
} else {
    setAccessContextStatus('infrastructure_unavailable');
}`);

fs.writeFileSync('contexts/EcosystemContext.tsx', file);
