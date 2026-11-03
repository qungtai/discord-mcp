import type { PToolRegistry, Toolset } from "../../src/core/tool-registry.js";

export function renderToolsBlock(
  registry: PToolRegistry,
  toolsets?: readonly Toolset[],
  defaultToolsets?: readonly Toolset[],
): string;

export function computeSummaryNumbers(
  registry: PToolRegistry,
  toolsets: readonly Toolset[],
): {
  toolCount: number;
  operationCount: number;
  implementedToolsets: Toolset[];
};

export function updateReadme(): Promise<void>;
