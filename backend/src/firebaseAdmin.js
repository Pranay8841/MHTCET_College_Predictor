const admin = require('firebase-admin');

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

// Only initialize if credentials are provided
if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');
} else {
  console.warn('⚠️  Firebase credentials not found. Running in offline mode.');
  // Initialize with a default app for development/testing
  try {
    admin.initializeApp();
  } catch (e) {
    console.warn('⚠️  Firebase default initialization failed. Firestore will not be available.');
  }
}

let db;
try {
  const databaseId = process.env.FIREBASE_DATABASE_ID;
  if (databaseId) {
    const { getFirestore } = require('firebase-admin/firestore');
    db = getFirestore(admin.apps[0], databaseId);
    console.log(`✅ Firestore initialized with Database ID: "${databaseId}"`);
  } else {
    db = admin.firestore();
  }
} catch (e) {
  console.warn('⚠️  Firestore not available. Some features will be disabled.');
  db = null;
}

module.exports = { db, admin };
