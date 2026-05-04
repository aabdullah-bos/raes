export interface Slice {
  position: number;
  label: string;
  complete: boolean;
}

export interface PipelineStatus {
  slices: Slice[];
  nextSlice: Slice | undefined;
  totalComplete: number;
  totalRemaining: number;
}

const BACKLOG_HEADING = /^#{1,3}\s+Slice Backlog\s*$/;
const NEXT_HEADING = /^#{1,3}\s+\S/;
const SLICE_ITEM = /^- \[(x| )\]\s+(.+)$/;

export function parseSlices(content: string): Slice[] {
  const lines = content.split('\n');
  const slices: Slice[] = [];
  let inBacklog = false;
  let position = 0;

  for (const line of lines) {
    if (BACKLOG_HEADING.test(line.trim())) {
      inBacklog = true;
      continue;
    }
    if (inBacklog && NEXT_HEADING.test(line.trim())) {
      break;
    }
    if (!inBacklog) continue;

    const m = SLICE_ITEM.exec(line.trim());
    if (m) {
      position += 1;
      slices.push({ position, label: m[2].trim(), complete: m[1] === 'x' });
    }
  }

  return slices;
}

export function getPipelineStatus(content: string): PipelineStatus {
  const slices = parseSlices(content);
  const totalComplete = slices.filter((s) => s.complete).length;
  const totalRemaining = slices.filter((s) => !s.complete).length;
  const nextSlice = slices.find((s) => !s.complete);
  return { slices, nextSlice, totalComplete, totalRemaining };
}
