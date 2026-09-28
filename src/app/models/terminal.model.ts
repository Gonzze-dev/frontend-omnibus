/** Terminal tal como la devuelve el backend (models.BusTerminal). */
export interface Terminal {
  uuid: string;
  external_terminal_id?: string | null;
  postal_code: string;
  name: string;
}

/** POST /api/super/terminals */
export interface CreateTerminalRequest {
  external_terminal_id: string;
  postal_code: string;
  name: string;
}

/** PUT /api/super/terminals/:uuid (campos opcionales, models.UpdateBusTerminalRequest). */
export interface UpdateTerminalRequest {
  external_terminal_id?: string;
  postal_code?: string;
  name?: string;
}

/** GET /api/super/terminals (models.ListTerminalsResponse). */
export interface ListTerminalesResponse {
  terminals: Terminal[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListTerminalesParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
}
