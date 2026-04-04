import { Request, Response } from 'express';
import { submitAndWaitForResult } from '../services/judge0.service';

export async function submitCode(req: Request, res: Response): Promise<void> {
  const {
    source_code,
    language_id,
    stdin,
    expected_output,
    cpu_time_limit,
    memory_limit,
  } = req.body;

  if (typeof source_code !== 'string' || source_code.trim().length === 0) {
    res.status(400).json({ message: 'source_code is required and must be a non-empty string' });
    return;
  }

  if (!Number.isInteger(language_id)) {
    res.status(400).json({ message: 'language_id is required and must be an integer' });
    return;
  }

  const result = await submitAndWaitForResult({
    source_code,
    language_id,
    stdin: typeof stdin === 'string' ? stdin : undefined,
    expected_output: typeof expected_output === 'string' ? expected_output : undefined,
    cpu_time_limit: typeof cpu_time_limit === 'number' ? cpu_time_limit : undefined,
    memory_limit: typeof memory_limit === 'number' ? memory_limit : undefined,
  });

  res.status(200).json({
    message: 'Execution completed',
    result,
  });
}
