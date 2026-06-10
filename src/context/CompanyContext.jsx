import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { setGlobalCompanyId } from '../lib/api';

export const CompanyContext = createContext();

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider = ({ children, session }) => {
  const [activeCompany, setActiveCompany] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [userRoles, setUserRoles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setCompanies([]);
      setUserRoles({});
      setActiveCompany(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        // Find companies user has access to, including their role
        const { data: cuData, error: cuError } = await supabase
          .from('company_users')
          .select('company_id, role, companies(*)')
          .eq('user_id', session.user.id);

        if (cuError) throw cuError;

        const rolesMap = {};
        const userCompanies = cuData.map(d => {
           if (d.companies) {
              rolesMap[d.companies.id] = d.role || 'admin';
           }
           return d.companies;
        }).filter(Boolean);
        
        setCompanies(userCompanies);
        setUserRoles(rolesMap);

        // Auto-select company from localStorage or fallback to first
        const savedCompanyId = localStorage.getItem('selected_company_id');
        const savedCompany = savedCompanyId ? userCompanies.find(c => c.id.toString() === savedCompanyId) : null;

        if (savedCompany) {
          selectCompany(savedCompany, rolesMap);
        } else if (userCompanies.length > 0) {
          selectCompany(userCompanies[0], rolesMap);
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

  const selectCompany = (company, rolesMapParam = userRoles) => {
    setActiveCompany(company);
    if (company) {
      setUserRole(rolesMapParam[company.id] || 'admin');
      setGlobalCompanyId(company.id);
      localStorage.setItem('selected_company_id', company.id.toString());
    } else {
      setUserRole(null);
      localStorage.removeItem('selected_company_id');
    }
    setLoading(false);
  };

  return (
    <CompanyContext.Provider value={{ activeCompany, companies, selectCompany, loading, userRole }}>
      {children}
    </CompanyContext.Provider>
  );
};
