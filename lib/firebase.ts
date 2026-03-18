import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCc_I2QJWLdeVsaTW_g9Cs3SNK6KRnULeA',
  authDomain: 'poker-home-62fab.firebaseapp.com',
  databaseURL: 'https://poker-home-62fab-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'poker-home-62fab',
  storageBucket: 'poker-home-62fab.firebasestorage.app',
  messagingSenderId: '619012333652',
  appId: '1:619012333652:web:2fa9678ba423d7f6b10dc1',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

export { db, auth, firestore };
