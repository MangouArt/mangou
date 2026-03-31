'use client';

import React, { createContext, useContext, ReactNode } from 'react';

export interface MangouUser {
  id: string;
  email: string;
  role: 'admin';
}

const UserContext = createContext<MangouUser | null>(null);

export const MangouAuthProvider = ({ children }: { children: ReactNode }) => {
  const adminUser: MangouUser = {
    id: 'mangou-admin',
    email: 'admin@mangou.ai',
    role: 'admin'
  };

  return (
    <UserContext.Provider value={adminUser}>
      {children}
    </UserContext.Provider>
  );
};

export const useMangouUser = () => {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error('useMangouUser must be used within a MangouAuthProvider');
  }
  return user;
};
