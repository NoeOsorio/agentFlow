import { describe, it, expect } from 'vitest'
import {
  getResourceKey,
  parseMultiDocumentYAML,
  serializeMultiDocumentYAML,
} from '../schema/resource'
import {
  parseMultiDocument,
  getKind,
  serializeMultiDocument,
} from '../parser/index'
import type { BaseResource } from '../schema/resource'

const MULTI_DOC_YAML = `
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
spec:
  agents:
    - name: bob
      role: CEO
      model:
        provider: anthropic
        model_id: claude-opus-4-6
---
apiVersion: agentflow.ai/v1
kind: Agent
metadata:
  name: alice
  namespace: acme-corp
spec:
  role: Lead Engineer
  model:
    provider: anthropic
    model_id: claude-sonnet-4-6
`

describe('Resource Utilities', () => {
  it('parseMultiDocument() splits 2-document YAML correctly', () => {
    const resources = parseMultiDocument(MULTI_DOC_YAML)
    expect(resources).toHaveLength(2)
    expect(resources[0]!.kind).toBe('Company')
    expect(resources[1]!.kind).toBe('Agent')
  })

  it('getKind() returns correct kind from YAML string', () => {
    expect(getKind('apiVersion: agentflow.ai/v1\nkind: Company\n')).toBe('Company')
    expect(getKind('apiVersion: agentflow.ai/v1\nkind: Agent\n')).toBe('Agent')
    expect(getKind('apiVersion: agentflow.ai/v1\nkind: Pipeline\n')).toBe('Pipeline')
    expect(getKind('no kind here')).toBeNull()
  })

  it('getResourceKey() returns "Company/default/acme-corp"', () => {
    const resource: BaseResource = {
      apiVersion: 'agentflow.ai/v1',
      kind: 'Company',
      metadata: { name: 'acme-corp', namespace: 'default' },
      spec: {},
    }
    expect(getResourceKey(resource)).toBe('Company/default/acme-corp')
  })

  it('serializeMultiDocument outputs valid YAML with --- separator', () => {
    const resources = parseMultiDocument(MULTI_DOC_YAML)
    const serialized = serializeMultiDocument(resources)
    expect(serialized).toContain('---')
    // Re-parse the serialized output
    const reparsed = parseMultiDocument(serialized)
    expect(reparsed).toHaveLength(2)
    expect(reparsed[0]!.kind).toBe('Company')
    expect(reparsed[1]!.kind).toBe('Agent')
  })

  it('parseMultiDocumentYAML splits raw YAML documents', () => {
    const docs = parseMultiDocumentYAML(MULTI_DOC_YAML)
    expect(docs).toHaveLength(2)
  })

  it('getKind handles quoted kind values', () => {
    expect(getKind("kind: 'Agent'")).toBe('Agent')
    expect(getKind('kind: "Company"')).toBe('Company')
  })
})
