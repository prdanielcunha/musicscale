const fs = require('fs');

const content = `import admin from 'firebase-admin';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { logger } from '../lib/logger.js';

dotenv.config();

let adminInitialized = false;
let currentCredentialSource = 'unavailable';
let targetProjectId = 'millionsnest';

function initAdmin() {
    if (admin.apps.length) return;

    try {
        let serviceAccountObj = null;
        let credential;
        
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
             try {
                  serviceAccountObj = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
                  currentCredentialSource = 'service_account_base64';
             } catch (e) {
                  logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64");
             }
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
             try {
                  const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
                  if (raw.startsWith('{') || raw.startsWith('[')) {
                       serviceAccountObj = JSON.parse(raw);
                       currentCredentialSource = 'service_account_json';
                  } else {
                       serviceAccountObj = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
                       currentCredentialSource = 'service_account_base64';
                  }
             } catch (e) {
                  logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT");
             }
        }
        
        if (serviceAccountObj) {
            credential = admin.credential.cert(serviceAccountObj);
        } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
            currentCredentialSource = 'individual_fields';
            credential = admin.credential.cert({
                 projectId: process.env.FIREBASE_PROJECT_ID,
                 clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                 privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, "\\n"),
            });
        } else {
            credential = admin.credential.applicationDefault();
            currentCredentialSource = 'application_default';
        }

        admin.initializeApp({
            credential,
            projectId: targetProjectId,
        });
        adminInitialized = true;
        logger.debug("Firebase Admin initialized successfully in firebaseAdmin.ts.");
    } catch (error) {
        logger.error("Failed to initialize Firebase Admin", error);
        currentCredentialSource = 'unavailable';
    }
}

initAdmin();

export const adminDb = admin.apps.length ? (() => {
    const db = admin.firestore();
    try {
        db.settings({ projectId: targetProjectId, ignoreUndefinedProperties: true });
    } catch(e){}
    return db;
})() : null;

export const adminAuth = admin.apps.length ? admin.auth() : null;

export async function getFirebaseAdminRuntimeStatus() {
    let firestoreAvailable = false;
    let authAvailable = false;
    let configurationValid = false;
    let safeErrorCode = null;

    if (!admin.apps.length) {
        return {
            initialized: false,
            projectId: targetProjectId,
            credentialSource: currentCredentialSource,
            authAvailable: false,
            firestoreAvailable: false,
            configurationValid: false,
            safeErrorCode: 'FIREBASE_ADMIN_CREDENTIAL_MISSING'
        };
    }
    
    try {
        if (currentCredentialSource !== 'application_default' && currentCredentialSource !== 'unavailable') {
            let saObj = null;
            if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
                 try { saObj = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')); } catch (e) {}
            } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                 try {
                      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
                      if (raw.startsWith('{') || raw.startsWith('[')) { saObj = JSON.parse(raw); } 
                      else { saObj = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
                 } catch (e) {}
            }
            if (saObj && saObj.project_id && saObj.project_id !== targetProjectId) {
                return {
                    initialized: true,
                    projectId: targetProjectId,
                    credentialSource: currentCredentialSource,
                    authAvailable: false,
                    firestoreAvailable: false,
                    configurationValid: false,
                    safeErrorCode: 'FIREBASE_PROJECT_MISMATCH'
                };
            }
        }
    } catch (e) {
    }

    try {
        if (adminAuth) {
             await adminAuth.getUser('non-existent-user-1234567890').catch(e => {
                 if (e.code === 'auth/user-not-found') {
                     authAvailable = true;
                 } else if (e.message && e.message.includes('credential')) {
                     authAvailable = false;
                     safeErrorCode = 'FIREBASE_ADMIN_CREDENTIAL_INVALID';
                 } else {
                     authAvailable = true;
                 }
             });
        }
    } catch (e) {
        authAvailable = false;
        if (!safeErrorCode) safeErrorCode = 'FIREBASE_AUTH_UNAVAILABLE';
    }

    try {
        if (adminDb && authAvailable) {
            await adminDb.collection('organizations').limit(1).get();
            firestoreAvailable = true;
        }
    } catch (e) {
        firestoreAvailable = false;
        if (e.code === 7 || (e.details && e.details.includes('Permission denied'))) {
            safeErrorCode = 'FIREBASE_ADMIN_PERMISSION_DENIED';
        } else if (!safeErrorCode) {
            safeErrorCode = 'FIRESTORE_UNAVAILABLE';
        }
    }

    configurationValid = authAvailable && firestoreAvailable;

    return {
        initialized: true,
        projectId: targetProjectId,
        credentialSource: currentCredentialSource,
        authAvailable,
        firestoreAvailable,
        configurationValid,
        safeErrorCode: configurationValid ? null : (safeErrorCode || 'UNKNOWN_ERROR')
    };
}

export { admin };
`;
fs.writeFileSync('services/firebaseAdmin.ts', content);
