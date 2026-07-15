const fs = require('fs');
let text = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');
text = text.replace(
  "if (orgData.status !== 'archived' && orgData.archived !== true) {",
  `let resolvedRole = roleToSet;
                                    try {
                                        const memDoc = await getDoc(doc(db, 'organizations', idToTest, 'members', user.uid));
                                        if (memDoc.exists()) {
                                            const md = memDoc.data();
                                            resolvedRole = md.organizationRole || md.musicscaleRole || md.appRole || md.role || resolvedRole;
                                        }
                                    } catch(me) {}
                                    if (orgData.status !== 'archived' && orgData.archived !== true) {`
);
text = text.replace("roleInOrg = roleToSet;", "roleInOrg = resolvedRole;");
text = text.replace("role: roleToSet });", "role: resolvedRole });");
fs.writeFileSync('contexts/EcosystemContext.tsx', text);
