const getFirebaseConfig = () => {
  if (typeof process !== 'undefined' && process.env) {
    return {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
  }
  
  return null;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFirebaseConfig };
} else {
  window.getFirebaseConfig = getFirebaseConfig;
}