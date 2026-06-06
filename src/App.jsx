import React, { createContext, useState, useEffect, useCallback, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import Titlebar from './components/Titlebar'
import LoadingSpinner from './components/LoadingSpinner'

import { SeasonContext } from './context/SeasonContext'

// ── Lazy-loaded Pages ────────────────────────────────────────────────
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const ProductsPage = React.lazy(() => import('./pages/masters/ProductsPage'))
const PartiesPage = React.lazy(() => import('./pages/masters/PartiesPage'))
const AssociatesPage = React.lazy(() => import('./pages/masters/AssociatesPage'))
const NewSalePage = React.lazy(() => import('./pages/sales/NewSalePage'))
const EditSalePage = React.lazy(() => import('./pages/sales/EditSalePage'))
const SaleReturnPage = React.lazy(() => import('./pages/sales/SaleReturnPage'))
const AllSalesPage = React.lazy(() => import('./pages/sales/AllSalesPage'))

const NewExpensePage = React.lazy(() => import('./pages/expenses/NewExpensePage'))
const AllExpensesPage = React.lazy(() => import('./pages/expenses/AllExpensesPage'))
const ExpenseTypesPage = React.lazy(() => import('./pages/expenses/ExpenseTypesPage'))
const SchemeSetupPage = React.lazy(() => import('./pages/schemes/SchemeSetupPage'))
const CouponIssuancePage = React.lazy(() => import('./pages/schemes/CouponIssuancePage'))
const RecordPaymentPage = React.lazy(() => import('./pages/payments/RecordPaymentPage'))
const PartyLedgerPage = React.lazy(() => import('./pages/payments/PartyLedgerPage'))
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'))
const SeasonsPage = React.lazy(() => import('./pages/settings/SeasonsPage'))
const SettingsPage = React.lazy(() => import('./pages/settings/SettingsPage'))

// ── Page Loading Fallback ────────────────────────────────────────────
function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Loading...</p>
      </div>
    </div>
  )
}

// ── App Component ────────────────────────────────────────────────────
export default function App() {
  const [activeSeason, setActiveSeason] = useState(null)
  const [allSeasons, setAllSeasons] = useState([])

  const refreshSeason = useCallback(async () => {
    try {
      const seasons = await window.db.invoke('seasons:getAll')
      setAllSeasons(seasons || [])
      const active = (seasons || []).find((s) => s.is_active)
      if (active) {
        setActiveSeason(active)
      }
    } catch (err) {
      console.error('Failed to load seasons:', err)
    }
  }, [])

  useEffect(() => {
    refreshSeason()
  }, [refreshSeason])

  return (
    <SeasonContext.Provider value={{ activeSeason, setActiveSeason, allSeasons, refreshSeason }}>
      <HashRouter>
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
          {/* Titlebar */}
          <Titlebar />

          {/* Main Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/masters/products" element={<ProductsPage />} />
                  <Route path="/masters/parties" element={<PartiesPage />} />
                  <Route path="/masters/associates" element={<AssociatesPage />} />
                  <Route path="/sales/new" element={<NewSalePage />} />
                  <Route path="/sales/edit/:id" element={<EditSalePage />} />
                  <Route path="/sales/all" element={<AllSalesPage />} />
                  <Route path="/sales/return" element={<SaleReturnPage />} />

                  <Route path="/expenses/new" element={<NewExpensePage />} />
                  <Route path="/expenses/all" element={<AllExpensesPage />} />
                  <Route path="/expenses/types" element={<ExpenseTypesPage />} />
                  <Route path="/schemes/setup" element={<SchemeSetupPage />} />
                  <Route path="/schemes/coupons" element={<CouponIssuancePage />} />
                  <Route path="/payments/record" element={<RecordPaymentPage />} />
                  <Route path="/payments/ledger" element={<PartyLedgerPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/seasons" element={<SeasonsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: "'DM Sans', sans-serif",
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#fff' },
              style: { border: '1px solid #dcfce7', background: '#f0fdf4' }
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
              style: { border: '1px solid #fee2e2', background: '#fef2f2' }
            }
          }}
        />
      </HashRouter>
    </SeasonContext.Provider>
  )
}
