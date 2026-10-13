/** Terminal as returned by the backend (models.BusTerminal). */
export interface Terminal {
  uuid: string;
  external_terminal_id?: string | null;
  postal_code: string;
  name: string;
}

/** Terminal of the bus ticket system (GET /api/super/get-external-terminals). */
export interface ExternalTerminal {
  uuid: string;
  name: string;
}

/** POST /api/super/terminals */
export interface CreateTerminalRequest {
  external_terminal_id: string;
  postal_code: string;
  name: string;
}

/** PUT /api/super/terminals/:uuid (optional fields, models.UpdateBusTerminalRequest). */
export interface UpdateTerminalRequest {
  external_terminal_id?: string;
  postal_code?: string;
  name?: string;
}

/** GET /api/super/terminals (models.ListTerminalsResponse). */
export interface ListTerminalsResponse {
  terminals: Terminal[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListTerminalsParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
}
