export type RaesSliceType = 'execution' | 'review';

export interface RaesSummaryLocation {
  path: string;
  line?: number;
}

export interface RaesSummarySlice {
  label: string;
  type: RaesSliceType;
  pipeline: RaesSummaryLocation;
  position?: number | string;
}

export interface RaesSummaryReference {
  path: string;
  line?: number;
  note?: string;
}

export interface RaesSummaryNamedItem {
  text: string;
  refs?: RaesSummaryReference[];
}

export interface RaesSummaryNextSlice {
  label: string;
  path?: string;
  line?: number;
  reason: string;
}

export interface RaesSummaryData {
  slice: RaesSummarySlice;
  artifactsInspected: RaesSummaryReference[];
  repoInspection: RaesSummaryNamedItem[];
  plan: string[];
  testsAddedOrUpdated: RaesSummaryNamedItem[];
  implementationChanges: RaesSummaryNamedItem[];
  findings: RaesSummaryNamedItem[];
  validation: string[];
  gaps: string[];
  artifactsProduced: string[];
  flags: string[];
  nextRecommendedSlice: RaesSummaryNextSlice;
}

export interface ExtractedRaesSummaryBlock {
  json: string | null;
  preludeText: string;
  trailingText: string;
}

export interface ParsedRaesSummary {
  summary: RaesSummaryData;
  rawJson: string;
  preludeText: string;
  trailingText: string;
}

const START = 'RAES_SUMMARY_START';
const END = 'RAES_SUMMARY_END';

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  const text = readString(value)?.trim();
  return text && text.length > 0 ? text : null;
}

function readLineNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
}

function readReference(value: unknown): RaesSummaryReference | null {
  const record = readRecord(value);
  const path = readNonEmptyString(record?.['path']);
  if (!path) return null;
  const line = readLineNumber(record?.['line']);
  const note = readNonEmptyString(record?.['note']) ?? undefined;
  return {
    path,
    ...(line !== undefined ? { line } : {}),
    ...(note ? { note } : {}),
  };
}

function readReferenceArray(value: unknown): RaesSummaryReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readReference(entry))
    .filter((entry): entry is RaesSummaryReference => entry !== null);
}

function readNamedItem(value: unknown): RaesSummaryNamedItem | null {
  const record = readRecord(value);
  const text = readNonEmptyString(record?.['text']);
  if (!text) return null;
  const refs = readReferenceArray(record?.['refs']);
  return {
    text,
    ...(refs.length > 0 ? { refs } : {}),
  };
}

function readNamedItemArray(value: unknown): RaesSummaryNamedItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readNamedItem(entry))
    .filter((entry): entry is RaesSummaryNamedItem => entry !== null);
}

function normalizeSummary(parsed: Record<string, unknown>): RaesSummaryData | null {
  const sliceRecord = readRecord(parsed['slice']);
  const pipelineRecord = readRecord(sliceRecord?.['pipeline']);
  const label = readNonEmptyString(sliceRecord?.['label']);
  const type = readNonEmptyString(sliceRecord?.['type']);
  const pipelinePath = readNonEmptyString(pipelineRecord?.['path']);
  if (!label || (type !== 'execution' && type !== 'review') || !pipelinePath) {
    return null;
  }

  const findings = readNamedItemArray(parsed['findings']);
  if (findings.length === 0) return null;

  const flags = readStringArray(parsed['flags']);
  if (flags.length === 0) return null;

  const nextRecord = readRecord(parsed['nextRecommendedSlice']);
  const nextLabel = readNonEmptyString(nextRecord?.['label']);
  const nextReason = readNonEmptyString(nextRecord?.['reason']);
  if (!nextLabel || !nextReason) return null;

  const position = sliceRecord?.['position'];
  const normalizedPosition = typeof position === 'string' || typeof position === 'number' ? position : undefined;

  return {
    slice: {
      label,
      type,
      pipeline: {
        path: pipelinePath,
        ...(readLineNumber(pipelineRecord?.['line']) !== undefined ? { line: readLineNumber(pipelineRecord?.['line']) } : {}),
      },
      ...(normalizedPosition !== undefined ? { position: normalizedPosition } : {}),
    },
    artifactsInspected: readReferenceArray(parsed['artifactsInspected']),
    repoInspection: readNamedItemArray(parsed['repoInspection']),
    plan: readStringArray(parsed['plan']),
    testsAddedOrUpdated: readNamedItemArray(parsed['testsAddedOrUpdated']),
    implementationChanges: readNamedItemArray(parsed['implementationChanges']),
    findings,
    validation: readStringArray(parsed['validation']),
    gaps: readStringArray(parsed['gaps']),
    artifactsProduced: readStringArray(parsed['artifactsProduced']),
    flags,
    nextRecommendedSlice: {
      label: nextLabel,
      ...(readNonEmptyString(nextRecord?.['path']) ? { path: readNonEmptyString(nextRecord?.['path']) ?? undefined } : {}),
      ...(readLineNumber(nextRecord?.['line']) !== undefined ? { line: readLineNumber(nextRecord?.['line']) } : {}),
      reason: nextReason,
    },
  };
}

function formatReference(ref: RaesSummaryReference): string {
  const base = ref.line !== undefined ? `${ref.path} (line ${ref.line})` : ref.path;
  return ref.note ? `${base} - ${ref.note}` : base;
}

function formatNamedItem(item: RaesSummaryNamedItem): string {
  if (!item.refs || item.refs.length === 0) return item.text;
  return `${item.text} [${item.refs.map((ref) => formatReference(ref)).join('; ')}]`;
}

function pushSection(lines: string[], heading: string, body: string[]): void {
  if (body.length === 0) return;
  if (lines.length > 0) lines.push('');
  lines.push(heading);
  lines.push('');
  lines.push(...body);
}

export function extractRaesSummaryBlock(output: string): ExtractedRaesSummaryBlock {
  const startMatches = [...output.matchAll(new RegExp(`^${START}$`, 'gm'))];
  const endMatches = [...output.matchAll(new RegExp(`^${END}$`, 'gm'))];
  if (startMatches.length !== 1 || endMatches.length !== 1) {
    return { json: null, preludeText: output, trailingText: '' };
  }

  const startIndex = startMatches[0]?.index;
  const endIndex = endMatches[0]?.index;
  if (startIndex === undefined || endIndex === undefined || endIndex <= startIndex) {
    return { json: null, preludeText: output, trailingText: '' };
  }

  const jsonStart = startIndex + START.length;
  const json = output.slice(jsonStart, endIndex).trim();
  return {
    json: json.length > 0 ? json : null,
    preludeText: output.slice(0, startIndex).trim(),
    trailingText: output.slice(endIndex + END.length).trim(),
  };
}

export function parseRaesSummary(output: string): ParsedRaesSummary | null {
  const extracted = extractRaesSummaryBlock(output);
  if (!extracted.json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.json);
  } catch {
    return null;
  }

  const record = readRecord(parsed);
  if (!record) return null;
  const summary = normalizeSummary(record);
  if (!summary) return null;

  return {
    summary,
    rawJson: extracted.json,
    preludeText: extracted.preludeText,
    trailingText: extracted.trailingText,
  };
}

export function renderRaesSummary(summary: RaesSummaryData): string[] {
  const lines: string[] = [];

  const slicePosition = summary.slice.position !== undefined ? ` ${summary.slice.position}` : '';
  const sliceType = summary.slice.type === 'review' ? 'Review Slice' : 'Execution Slice';
  const pipelineRef = summary.slice.pipeline.line !== undefined
    ? `${summary.slice.pipeline.path} (line ${summary.slice.pipeline.line})`
    : summary.slice.pipeline.path;
  pushSection(lines, 'Current Slice', [
    `${summary.slice.label}${slicePosition ? ` [Position ${slicePosition.trim()}]` : ''}`,
    `${sliceType} in ${pipelineRef}`,
  ]);

  pushSection(lines, 'Artifacts Inspected', summary.artifactsInspected.map((ref) => formatReference(ref)));
  pushSection(lines, 'Repo Inspection', summary.repoInspection.map((item) => formatNamedItem(item)));
  pushSection(lines, 'Plan', summary.plan);
  pushSection(lines, 'Tests Added/Updated', summary.testsAddedOrUpdated.map((item) => formatNamedItem(item)));
  pushSection(lines, 'Implementation Changes', summary.implementationChanges.map((item) => formatNamedItem(item)));
  pushSection(lines, 'Findings', summary.findings.map((item) => formatNamedItem(item)));
  pushSection(lines, 'Validation', summary.validation);
  pushSection(lines, 'Gaps (Explicit)', summary.gaps);
  pushSection(lines, 'Output Artifact(s) Produced', summary.artifactsProduced);
  pushSection(lines, 'Flags', summary.flags);

  const nextSlice = summary.nextRecommendedSlice.path
    ? `${summary.nextRecommendedSlice.label} in ${summary.nextRecommendedSlice.path}${summary.nextRecommendedSlice.line !== undefined ? ` (line ${summary.nextRecommendedSlice.line})` : ''}`
    : summary.nextRecommendedSlice.label;
  pushSection(lines, 'Next Recommended Slice', [
    nextSlice,
    `Reason: ${summary.nextRecommendedSlice.reason}`,
  ]);

  return lines;
}
