// @plan B0-PR-1
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const CanvasPage = lazy(() => import('./pages/CanvasPage'))
const PipelinesPage = lazy(() => import('./pages/PipelinesPage'))
const RunsPage = lazy(() => import('./pages/RunsPage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const CompanyPage = lazy(() => import('./pages/CompanyPage'))
const AgentDetailPage = lazy(() => import('./pages/AgentDetailPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/pipelines" replace />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/canvas/new" element={<CanvasPage />} />
        <Route path="/canvas/:pipelineName" element={<CanvasPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/new" element={<CompanyPage />} />
        <Route path="/companies/:companyName/agents/:agentName" element={<AgentDetailPage />} />
        <Route path="/companies/:companyName" element={<CompanyPage />} />
      </Routes>
    </Suspense>
  )
}
