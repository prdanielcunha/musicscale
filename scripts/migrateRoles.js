const admin = require("firebase-admin");

if (!admin.apps.length) {
    // Requires GOOGLE_APPLICATION_CREDENTIALS to be set.
    // However, if we just have a UI button inside the app it's better because we already have client-side auth.
}
