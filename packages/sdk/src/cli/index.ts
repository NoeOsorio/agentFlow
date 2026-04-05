#!/usr/bin/env node

import * as fs from "node:fs";
import { Command } from "commander";
import { client, loadConfig, saveConfig } from "./client.js";
import { formatOutput } from "./formatters.js";

const program = new Command();

program
  .name("agentflow")
  .description("kubectl-style CLI for AgentFlow")
  .version("0.0.1");

// ── apply ───────────────────────────────────────────────────────────
program
  .command("apply")
  .description("Apply a YAML manifest (company, pipeline, etc.)")
  .requiredOption("-f, --file <path>", "Path to YAML file")
  .action(async (opts: { file: string }) => {
    const content = fs.readFileSync(opts.file, "utf-8");
    const result = await client.post("/api/apply", { yaml_content: content });
    console.log(JSON.stringify(result, null, 2));
  });

// ── get ─────────────────────────────────────────────────────────────
const get = program.command("get").description("List resources");

get
  .command("companies")
  .description("List all companies")
  .option("-o, --output <format>", "Output format: table, json, yaml", "table")
  .action(async (opts: { output: "table" | "json" | "yaml" }) => {
    const data = (await client.get("/api/companies/")) as Record<string, unknown>[];
    console.log(
      formatOutput(data, opts.output, [
        { key: "name", header: "NAME" },
        { key: "namespace", header: "NAMESPACE" },
        { key: "created_at", header: "CREATED" },
      ]),
    );
  });

get
  .command("pipelines")
  .description("List all pipelines")
  .option("-o, --output <format>", "Output format: table, json, yaml", "table")
  .action(async (opts: { output: "table" | "json" | "yaml" }) => {
    const data = (await client.get("/api/pipelines/")) as Record<string, unknown>[];
    console.log(
      formatOutput(data, opts.output, [
        { key: "name", header: "NAME" },
        { key: "namespace", header: "NAMESPACE" },
        { key: "version", header: "VERSION" },
        { key: "created_at", header: "CREATED" },
      ]),
    );
  });

get
  .command("runs")
  .description("List runs")
  .option("--pipeline <name>", "Filter by pipeline name")
  .option("-o, --output <format>", "Output format: table, json, yaml", "table")
  .action(async (opts: { pipeline?: string; output: "table" | "json" | "yaml" }) => {
    const query = opts.pipeline ? `?pipeline_name=${opts.pipeline}` : "";
    const data = (await client.get(`/api/runs/${query}`)) as Record<string, unknown>[];
    console.log(
      formatOutput(data, opts.output, [
        { key: "id", header: "ID" },
        { key: "status", header: "STATUS" },
        { key: "started_at", header: "STARTED" },
        { key: "finished_at", header: "FINISHED" },
      ]),
    );
  });

// ── delete ──────────────────────────────────────────────────────────
const del = program.command("delete").description("Delete resources");

del
  .command("company <name>")
  .description("Delete a company by name")
  .action(async (name: string) => {
    await client.delete(`/api/companies/${name}`);
    console.log(`company "${name}" deleted`);
  });

del
  .command("pipeline <name>")
  .description("Delete a pipeline by name")
  .action(async (name: string) => {
    await client.delete(`/api/pipelines/${name}`);
    console.log(`pipeline "${name}" deleted`);
  });

// ── run ─────────────────────────────────────────────────────────────
program
  .command("run <pipeline-name>")
  .description("Execute a pipeline")
  .option("--input <data>", "JSON input data for the trigger")
  .action(async (pipelineName: string, opts: { input?: string }) => {
    const body = opts.input ? { trigger_data: JSON.parse(opts.input) } : {};
    const result = await client.post(
      `/api/pipelines/${pipelineName}/execute`,
      body,
    );
    console.log(JSON.stringify(result, null, 2));
  });

// ── logs ────────────────────────────────────────────────────────────
program
  .command("logs <run-id>")
  .description("Stream logs for a run (SSE)")
  .action(async (runId: string) => {
    const config = loadConfig();
    const url = `${config.apiUrl}/api/runs/${runId}/logs`;
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Failed to stream logs (${res.status})`);
      process.exit(1);
    }
    if (!res.body) {
      console.error("No response body");
      process.exit(1);
    }

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) {
        process.stdout.write(decoder.decode(chunk.value, { stream: true }));
      }
    }
  });

// ── config ──────────────────────────────────────────────────────────
const config = program.command("config").description("Manage CLI configuration");

config
  .command("set-context")
  .description("Set the API connection context")
  .requiredOption("--url <url>", "API server URL")
  .option("--key <api-key>", "API key for authentication")
  .action((opts: { url: string; key?: string }) => {
    saveConfig({ apiUrl: opts.url, apiKey: opts.key });
    console.log(`Context saved: ${opts.url}`);
  });

config.command("view").description("Show current config").action(() => {
  const cfg = loadConfig();
  console.log(JSON.stringify(cfg, null, 2));
});

program.parseAsync(process.argv);
