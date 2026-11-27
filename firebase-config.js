// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnRd_7Zs47HZWtOOCtRfFOrZ8ZpHoW2lw",
  authDomain: "subway-surfers-7ca74.firebaseapp.com",
  projectId: "subway-surfers-7ca74",
  storageBucket: "subway-surfers-7ca74.firebasestorage.app",
  messagingSenderId: "171070043536",
  appId: "1:171070043536:web:af7c68c67eb139a9b26f15",
  measurementId: "G-40PRK9R4JH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
