import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, syncBookToCloud, syncProgressToCloud, fetchUserBooksFromCloud } from '../services/firebase';
import { Book } from '../types/book';
import { saveBook, getAllBooks } from '../services/storageService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  syncCurrentBook: (book: Book) => Promise<void>;
  syncProgress: (bookId: string, chap: number, para: number, percent: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync cloud books
        try {
          setIsSyncing(true);
          const cloudBooks = await fetchUserBooksFromCloud(currentUser.uid);
          // Merge with local books
          if (cloudBooks && cloudBooks.length > 0) {
            const localBooks = await getAllBooks();
            for (const cBook of cloudBooks) {
              const existing = localBooks.find(b => b.id === cBook.bookId);
              if (existing) {
                // If cloud is more recent, update progress
                if ((cBook.lastReadAt || 0) > (existing.lastReadAt || 0)) {
                  await saveBook({
                    ...existing,
                    currentChapterIndex: cBook.currentChapterIndex,
                    currentParagraphIndex: cBook.currentParagraphIndex,
                    progressPercent: cBook.progressPercent,
                    lastReadAt: cBook.lastReadAt,
                    isFavorite: cBook.isFavorite !== undefined ? cBook.isFavorite : existing.isFavorite,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.warn('Initial cloud sync error:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google Sign In failed:', err);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const syncCurrentBook = async (book: Book) => {
    if (!user) return;
    try {
      await syncBookToCloud(user.uid, book);
    } catch (err) {
      console.warn('Failed to sync book to cloud:', err);
    }
  };

  const syncProgress = async (bookId: string, chap: number, para: number, percent: number) => {
    if (!user) return;
    try {
      await syncProgressToCloud(user.uid, bookId, chap, para, percent);
    } catch (err) {
      console.warn('Failed to sync progress to cloud:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSyncing,
        login,
        logout,
        syncCurrentBook,
        syncProgress
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
