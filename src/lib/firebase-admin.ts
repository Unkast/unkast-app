import admin from "firebase-admin";

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    // Fallback: initialize without credentials (push won't work but app won't crash)
    admin.initializeApp();
  }
}

export default admin;
