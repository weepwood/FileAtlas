import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DuplicatesPage = lazy(() => import('./pages/DuplicatesPage').then((module) => ({ default: module.DuplicatesPage })))
const ExplorerPage = lazy(() => import('./pages/ExplorerPage').then((module) => ({ default: module.ExplorerPage })))
const ExportsPage = lazy(() => import('./pages/ExportsPage').then((module) => ({ default: module.ExportsPage })))
const HealthPage = lazy(() => import('./pages/HealthPage').then((module) => ({ default: module.HealthPage })))
const NamingPage = lazy(() => import('./pages/NamingPage').then((module) => ({ default: module.NamingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const SnapshotsPage = lazy(() => import('./pages/SnapshotsPage').then((module) => ({ default: module.SnapshotsPage })))
const SpacePage = lazy(() => import('./pages/SpacePage').then((module) => ({ default: module.SpacePage })))

function PageFallback() {
  return <div className="route-loading"><span className="pulse-dot" />正在加载模块</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="explorer" element={<ExplorerPage />} />
            <Route path="space" element={<SpacePage />} />
            <Route path="duplicates" element={<DuplicatesPage />} />
            <Route path="naming" element={<NamingPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="snapshots" element={<SnapshotsPage />} />
            <Route path="exports" element={<ExportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
