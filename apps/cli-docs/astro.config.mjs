import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "AgentFlow CLI",
      description: "kubectl-style CLI for AgentFlow — build and manage AI agent pipelines",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      social: {
        github: "https://github.com/agentflow/agentflow",
      },
      editLink: {
        baseUrl:
          "https://github.com/agentflow/agentflow/edit/main/apps/docs/",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quickstart" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Writing YAML Manifests", slug: "guides/yaml-manifests" },
            { label: "Running Pipelines", slug: "guides/running-pipelines" },
            { label: "Output Formats", slug: "guides/output-formats" },
          ],
        },
        {
          label: "CLI Reference",
          items: [
            { label: "apply", slug: "reference/apply" },
            { label: "get", slug: "reference/get" },
            { label: "run", slug: "reference/run" },
            { label: "logs", slug: "reference/logs" },
            { label: "delete", slug: "reference/delete" },
            { label: "config", slug: "reference/config" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
