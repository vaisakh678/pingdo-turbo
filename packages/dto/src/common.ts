/** Standard API envelope. `error` is set (and `data` null) on failure. */
export interface APIResponse<T> {
  data: T;
  error?: string | null;
}

/** Where the request was served from. Surfaced on /ping and /health so the
 *  latency page can label each endpoint by its actual region. */
export interface ServerInfoDTO {
  platform: string;
  region: string;
}
