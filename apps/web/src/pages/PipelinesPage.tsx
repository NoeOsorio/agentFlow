import { Link } from 'react-router-dom'

export default function PipelinesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AgentFlow</h1>
        <p className="text-gray-400 mt-1">AI agent pipeline orchestration</p>
      </header>
      <main>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Pipelines</h2>
          <Link
            to="/canvas/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            New Pipeline
          </Link>
        </div>
        <div className="border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          <p>No pipelines yet. Create your first one.</p>
        </div>
      </main>
    </div>
  )
}
