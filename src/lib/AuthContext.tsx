import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetProfileSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            // Update photoURL if it changed or was missing
            if (firebaseUser.photoURL && userData.photoURL !== firebaseUser.photoURL) {
              const updatedData = { ...userData, photoURL: firebaseUser.photoURL };
              await setDoc(doc(db, 'users', firebaseUser.uid), { photoURL: firebaseUser.photoURL }, { merge: true });
              setUser(updatedData);
            } else {
              setUser(userData);
            }
          } else {
            // Create new user profile (incomplete)
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || undefined,
              role: 'student', // Default role, will be chosen during onboarding
              createdAt: Date.now(),
              isProfileComplete: false,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setAuthError("Không thể tải thông tin người dùng. Vui lòng thử lại.");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất. Vui lòng thử lại và giữ cửa sổ mở.");
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError("Cửa sổ đăng nhập bị chặn bởi trình duyệt. Vui lòng cho phép cửa sổ bật lên (popup) cho trang web này.");
      } else {
        setAuthError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
      }
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { ...user, role }, { merge: true });
      setUser({ ...user, role });
    } catch (error) {
      console.error("Update Role Error:", error);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    try {
      const updatedUser = { ...user, ...data, isProfileComplete: true };
      await setDoc(doc(db, 'users', user.uid), updatedUser, { merge: true });
      setUser(updatedUser);
    } catch (error) {
      console.error("Update Profile Error:", error);
      throw error;
    }
  };

  const resetProfileSetup = async () => {
    if (!user) return;
    try {
      const updatedUser = { ...user, isProfileComplete: false };
      await setDoc(doc(db, 'users', user.uid), { isProfileComplete: false }, { merge: true });
      setUser(updatedUser);
    } catch (error) {
      console.error("Reset Profile Error:", error);
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, signOut, clearError, updateRole, updateProfile, resetProfileSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
