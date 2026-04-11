// @plan B0-PR-1
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function PipelinesPage() {
  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-gray-400 mt-1 text-sm">AI agent pipeline orchestration</p>
        </div>
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
    </Layout>
  )
}
