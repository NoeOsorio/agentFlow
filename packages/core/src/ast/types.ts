export interface ResourceConfig {
  tokens: number
  timeout: string
}

export interface AgentConfig {
  name: string
  image?: string
  dependsOn?: string[]
  resources?: ResourceConfig
  minScore?: number
}

export interface TriggerConfig {
  source: string
  intake?: string
}

export interface ContextConfig {
  builder: string
  shared: boolean
}

export interface PolicyConfig {
  concurrency: number
  budget: string
  retries: number
  backoff: string
  onFailure: string
}

export interface DeployConfig {
  provider: string
  domain: string
}

export interface NotifyConfig {
  channel: string
  template: string
}

export interface OutputConfig {
  type: string
  deploy?: DeployConfig
  notify?: NotifyConfig
}

export interface PipelineAST {
  apiVersion: string
  kind: string
  namespace: string
  name: string
  trigger: TriggerConfig
  context: ContextConfig
  agents: AgentConfig[]
  policy: PolicyConfig
  output: OutputConfig
}
