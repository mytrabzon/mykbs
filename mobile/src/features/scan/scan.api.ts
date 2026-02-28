/**
 * Scan API: POST /scan/mrz/parse, POST /scan/doc/parse with correlationId.
 */

import { getBackendUrl } from '../../config/api';
import { getToken } from '../../services/apiSupabase';
import type { MrzDocTypeHint, MrzParseResponse } from './scan.types';
import type { DocParseDocType, DocParseResponse } from './scan.types';

async function getAuthHeaders(correlationId: string): Promise<HeadersInit> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * POST /api/scan/mrz/parse
 */
export async function postScanMrzParse(
  imageBase64: string,
  docTypeHint: MrzDocTypeHint,
  correlationId: string
): Promise<MrzParseResponse> {
  const url = `${getBackendUrl()}/api/scan/mrz/parse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: (await getAuthHeaders(correlationId)) as Record<string, string>,
    body: JSON.stringify({ imageBase64, docTypeHint, correlationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data as MrzParseResponse;
}

/**
 * POST /api/scan/doc/parse
 */
export async function postScanDocParse(
  imageBase64: string,
  docType: DocParseDocType,
  correlationId: string
): Promise<DocParseResponse> {
  const url = `${getBackendUrl()}/api/scan/doc/parse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: (await getAuthHeaders(correlationId)) as Record<string, string>,
    body: JSON.stringify({ imageBase64, docType, correlationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data as DocParseResponse;
}
