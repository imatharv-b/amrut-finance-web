import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { setGlobalCompanyId } from '../lib/api';

export const CompanyContext = createContext();

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider = ({ children, session }) => {
  const [activeCompany, setActiveCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setCompanies([]);
      setActiveCompany(null);
      setLoading(false);
      return;
    }

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        // Find companies user has access to
        const { data: cuData, error: cuError } = await supabase
          .from('company_users')
          .select('company_id, companies(*)')
          .eq('user_id', session.user.id);

        if (cuError) throw cuError;

        const userCompanies = cuData.map(d => d.companies).filter(Boolean);
        setCompanies(userCompanies);

        // Auto-select first company
        if (userCompanies.length > 0) {
          selectCompany(userCompanies[0]);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load companies:", err);
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [session]);

  const selectCompany = (company) => {
    setActiveCompany(company);
    setGlobalCompanyId(company.id);
    setLoading(false);
  };

  return (
    <CompanyContext.Provider value={{ activeCompany, companies, selectCompany, loading }}>
      {children}
    </CompanyContext.Provider>
  );
};
