import type { PToolRegistry, Toolset } from "../../src/core/tool-registry.js";

export function renderToolsBlock(
  registry: PToolRegistry,
  toolsets: readonly Toolset[],
  defaultToolsets: readonly Toolset[],
): string;

export interface SummaryNumbers {
  toolCount: number;
  operationCount: number;
  implementedToolsets: Toolset[];
  totalOperations: number;
  liveCount: number;
  mockCount: number;
}

export function computeSummaryNumbers(
  registry: PToolRegistry,
  toolsets: readonly Toolset[],
): SummaryNumbers;

export function renderSummary(summary: SummaryNumbers): string;

export function updateReadme(): Promise<void>;
