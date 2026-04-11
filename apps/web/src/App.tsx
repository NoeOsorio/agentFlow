// @plan B0-PR-1
import { Routes, Route, Navigate } from 'react-router-dom'
import CanvasPage from './pages/CanvasPage'
import PipelinesPage from './pages/PipelinesPage'
import RunsPage from './pages/RunsPage'
import CompaniesPage from './pages/CompaniesPage'
import CompanyPage from './pages/CompanyPage'
import AgentDetailPage from './pages/AgentDetailPage'

export default function App() {
  return (
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
  )
}
