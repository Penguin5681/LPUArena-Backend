const ILLEGAL_CODE_PATTERNS: RegExp[] = [
  /\bsystem\s*\(/i,
  /\bpopen\s*\(/i,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /child_process/i,
  /Runtime\.getRuntime\s*\(/i,
  /ProcessBuilder\s*\(/i,
  /os\.system\s*\(/i,
  /subprocess\./i,
  /fork\s*\(/i,
];

export function detectIllegalCodeInjection(sourceCode: string): {
  isIllegal: boolean;
  matchedPattern: string | null;
} {
  for (const pattern of ILLEGAL_CODE_PATTERNS) {
    if (pattern.test(sourceCode)) {
      return { isIllegal: true, matchedPattern: pattern.source };
    }
  }

  return { isIllegal: false, matchedPattern: null };
}
