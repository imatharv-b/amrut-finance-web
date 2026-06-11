import React, { createContext, useState } from 'react';

export const MobileMenuContext = createContext();

export function MobileMenuProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <MobileMenuContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}
