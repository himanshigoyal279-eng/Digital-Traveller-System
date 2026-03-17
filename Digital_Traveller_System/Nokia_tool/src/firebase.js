import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - Replace with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyDIWlZCytAw7-sD2vO1_XQDYT3C5l0LsOg",
    authDomain: "vijay-tools-a0b76.firebaseapp.com",
    projectId: "vijay-tools-a0b76",
    storageBucket: "vijay-tools-a0b76.firebasestorage.app",
    messagingSenderId: "240086406094",
    appId: "1:240086406094:web:087891732ec7da38fe119f",
  };
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
export default app;

