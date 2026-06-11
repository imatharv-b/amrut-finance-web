import React, { createContext, useState } from 'react';

export const MobileMenuContext = createContext();

export function MobileMenuProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);

  return (
    <MobileMenuContext.Provider value={{ isOpen, setIsOpen, isDesktopOpen, setIsDesktopOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}
