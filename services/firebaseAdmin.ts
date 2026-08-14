import admin from 'firebase-admin';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { logger } from '../lib/logger.js';

dotenv.config();

if (!admin.apps.length) {
    try {
        const firebaseConfig = fs.existsSync('./firebase-applet-config.json') 
            ? JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'))
            : {};
        
        let credential;
        let serviceAccountObj: any = null;
        
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
             try {
                  serviceAccountObj = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
             } catch (e) {
                  logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64 in firebaseAdmin.ts", e);
             }
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
             try {
                  const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
                  if (raw.startsWith('{') || raw.startsWith('[')) {
                       serviceAccountObj = JSON.parse(raw);
                  } else {
                       serviceAccountObj = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
                  }
             } catch (e) {
                  logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT in firebaseAdmin.ts", e);
             }
        }

        // In emulator/E2E mode the browser receives ID tokens for the explicit
        // demo project. Firebase Admin must validate against that same project;
        // otherwise verifyIdToken rejects a valid emulator token because its
        // audience is demo-musicscale while Admin was initialized from the
        // canonical firebase-applet-config.json project. Production keeps the
        // canonical configuration because this branch is only selected when the
        // Auth Emulator is explicitly enabled.
        const emulatorProjectId = process.env.FIREBASE_AUTH_EMULATOR_HOST
            ? (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID)
            : undefined;
        const appProjectId = emulatorProjectId ||
            firebaseConfig.projectId ||
            process.env.FIREBASE_PROJECT_ID ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.GCLOUD_PROJECT ||
            'millionsnest';

        if (serviceAccountObj) {
             serviceAccountObj.project_id = appProjectId;
             credential = admin.credential.cert(serviceAccountObj);
        } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
             credential = admin.credential.cert({
                 projectId: process.env.FIREBASE_PROJECT_ID,
                 clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                 privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
             });
        }
            
        // @ts-ignore - explicitly read but maybe unused later depending on the codebase
        const _saProjectId = serviceAccountObj && (serviceAccountObj.project_id || serviceAccountObj.projectId);
        if (_saProjectId) { /* dummy read */ }

        admin.initializeApp({
            ...(credential ? { credential } : {}),
            projectId: appProjectId,
        });

        logger.debug(`Firebase Admin initialized successfully in firebaseAdmin.ts (projectId=${appProjectId}).`);
    } catch (error) {
        logger.error("Failed to initialize Firebase Admin", error);
    }
}

export const adminDb = admin.apps.length ? (() => {
    const db = admin.firestore();
    try {
        // Keep Firestore on the exact project used to initialize Admin/Auth.
        // This is especially important under emulators, where Auth and Firestore
        // must share the same demo project namespace.
        const pId = String(admin.app().options.projectId || 'millionsnest');
        db.settings({ projectId: pId, ignoreUndefinedProperties: true });
    } catch(e){}
    return db;
})() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export { admin };
