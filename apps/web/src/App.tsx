import { Routes, Route, Navigate } from 'react-router-dom'
import CanvasPage from './pages/CanvasPage'
import PipelinesPage from './pages/PipelinesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pipelines" replace />} />
      <Route path="/pipelines" element={<PipelinesPage />} />
      <Route path="/canvas/:id" element={<CanvasPage />} />
      <Route path="/canvas/new" element={<CanvasPage />} />
    </Routes>
  )
}
