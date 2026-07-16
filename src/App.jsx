import React, { createContext, useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import Titlebar from './components/Titlebar'
import LoadingSpinner from './components/LoadingSpinner'
import ShortcutListener from './components/ShortcutListener'

import { SeasonContext } from './context/SeasonContext'
import { CompanyProvider, useCompany } from './context/CompanyContext'
import { MobileMenuProvider } from './context/MobileMenuContext'
import { supabase } from './lib/supabase'
import LoginPage from './pages/auth/LoginPage'
import CompanySelectPage from './pages/auth/CompanySelectPage'
// ── Lazy-loaded Pages ────────────────────────────────────────────────
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const ProductsPage = React.lazy(() => import('./pages/masters/ProductsPage'))
const PartiesPage = React.lazy(() => import('./pages/masters/PartiesPage'))
const AssociatesPage = React.lazy(() => import('./pages/masters/AssociatesPage'))
const NewSalePage = React.lazy(() => import('./pages/sales/NewSalePage'))
const EditSalePage = React.lazy(() => import('./pages/sales/EditSalePage'))
const SaleReturnPage = React.lazy(() => import('./pages/sales/SaleReturnPage'))
const AllSalesPage = React.lazy(() => import('./pages/sales/AllSalesPage'))

const NewPurchasePage = React.lazy(() => import('./pages/purchases/NewPurchasePage'))
const EditPurchasePage = React.lazy(() => import('./pages/purchases/EditPurchasePage'))
const AllPurchasesPage = React.lazy(() => import('./pages/purchases/AllPurchasesPage'))

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
const AnalyticsPage = React.lazy(() => import('./pages/reports/AnalyticsPage'))
const WorkersPage = React.lazy(() => import('./pages/workers/WorkersPage'))
const AttendancePage = React.lazy(() => import('./pages/workers/AttendancePage'))
const WorkerLedgerPage = React.lazy(() => import('./pages/workers/WorkerLedgerPage'))
const WeeklySummaryPage = React.lazy(() => import('./pages/workers/WeeklySummaryPage'))
const MonthlySalaryPage = React.lazy(() => import('./pages/workers/MonthlySalaryPage'))
// ── Page Loading Fallback ────────────────────────────────────────────
function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-slate-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Loading...</p>
      </div>
    </div>
  )
}

function AppWithCompany() {
  const { activeCompany, loading, userRole } = useCompany()
  const [activeSeason, setActiveSeason] = useState(null)
  const [allSeasons, setAllSeasons] = useState([])
  const hasMergedRef = useRef(false)

  const refreshSeason = useCallback(async () => {
    try {
      if (!activeCompany) {
        setActiveSeason(null)
        setAllSeasons([])
        return
      }
      // On first load only, merge any duplicate seasons to recover data
      if (!hasMergedRef.current) {
        hasMergedRef.current = true
        try {
          const mergeResult = await window.db.invoke('seasons:mergeDuplicates')
          if (mergeResult?.merged > 0) {
            console.log(`Merged ${mergeResult.merged} duplicate season(s)`)
          }
        } catch (mergeErr) {
          console.warn('Season merge skipped:', mergeErr)
        }
      }
      const seasons = await window.db.invoke('seasons:getAll')
      setAllSeasons(seasons || [])
      const active = (seasons || []).find((s) => s.is_active)
      // ALWAYS update activeSeason — clear it if no active season found
      setActiveSeason(active || null)
    } catch (err) {
      console.error('Failed to load seasons:', err)
    }
  }, [activeCompany])

  useEffect(() => {
    if (activeCompany) {
      refreshSeason()
    }
  }, [refreshSeason, activeCompany])

  if (loading) return <PageFallback />
  if (!activeCompany) return <CompanySelectPage />

  const role = userRole || 'admin';

  return (
    <SeasonContext.Provider value={{ activeSeason, setActiveSeason, allSeasons, refreshSeason }}>
      <MobileMenuProvider>
        <HashRouter>
          <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
            {/* Titlebar */}
          <Titlebar />

          {/* Main Layout */}
          <div className="flex flex-1 overflow-hidden">
            <ShortcutListener />
            {/* Sidebar */}
            <Sidebar />

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  {/* Public/Common Routes */}
                  <Route path="/masters/products" element={<ProductsPage />} />
                  <Route path="/masters/parties" element={<PartiesPage />} />
                  <Route path="/sales/new" element={<NewSalePage />} />
                  <Route path="/sales/edit/:id" element={<EditSalePage />} />
                  <Route path="/sales/all" element={<AllSalesPage />} />
                  <Route path="/sales/return" element={<SaleReturnPage />} />
                  
                  <Route path="/purchases/new" element={<NewPurchasePage />} />
                  <Route path="/purchases/edit/:id" element={<EditPurchasePage />} />
                  <Route path="/purchases/all" element={<AllPurchasesPage />} />
                  <Route path="/expenses/new" element={<NewExpensePage />} />
                  <Route path="/expenses/all" element={<AllExpensesPage />} />
                  <Route path="/expenses/types" element={<ExpenseTypesPage />} />
                  <Route path="/payments/record" element={<RecordPaymentPage />} />
                  <Route path="/payments/ledger" element={<PartyLedgerPage />} />
                  <Route path="/workers/all" element={<WorkersPage />} />
                  <Route path="/workers/attendance" element={<AttendancePage />} />
                  <Route path="/workers/ledger" element={<WorkerLedgerPage />} />
                  <Route path="/workers/summary" element={<WeeklySummaryPage />} />
                  <Route path="/workers/monthly-salary" element={<MonthlySalaryPage />} />

                  {/* Admin Only Routes */}
                  {role === 'admin' ? (
                    <>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/masters/associates" element={<AssociatesPage />} />
                      <Route path="/schemes/setup" element={<SchemeSetupPage />} />
                      <Route path="/schemes/coupons" element={<CouponIssuancePage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/seasons" element={<SeasonsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </>
                  ) : role === 'salesman' ? (
                    <>
                      {/* Salesman user redirect from home to a default view */}
                      <Route path="/schemes/coupons" element={<CouponIssuancePage />} />
                      <Route path="/" element={<Navigate to="/payments/ledger" replace />} />
                      <Route path="*" element={<Navigate to="/payments/ledger" replace />} />
                    </>
                  ) : (
                    <>
                      {/* Data Entry user redirect from home to a default page */}
                      <Route path="/" element={<Navigate to="/sales/new" replace />} />
                      <Route path="*" element={<Navigate to="/sales/new" replace />} />
                    </>
                  )}
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>

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
            }
          }}
        />
      </HashRouter>
      </MobileMenuProvider>
    </SeasonContext.Provider>
  )
}

// ── App Component ────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const sessionTokenRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionTokenRef.current = session?.access_token || null
      setSession(session)
      setIsInitializing(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newToken = newSession?.access_token || null
      // Only update state if the session actually changed (sign-in/sign-out),
      // not on routine token refreshes that happen when switching browser tabs
      if (newToken !== sessionTokenRef.current) {
        sessionTokenRef.current = newToken
        setSession(newSession)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isInitializing) {
    return <PageFallback />
  }

  if (!session) {
    return (
      <>
        <LoginPage onLogin={setSession} />
        <Toaster position="top-right" />
      </>
    )
  }

  return (
    <CompanyProvider session={session}>
      <AppWithCompany />
    </CompanyProvider>
  )
}
