/** Bay coordinates, as stored in the jsonb coordinates column. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** Platform returned by POST/PUT /api/admin/platforms (models.Platform). */
export interface Platform {
  code: number;
  bay: string;
  coordinates: Coordinates;
  bus_terminal_id: string;
}

/** Platform inside a terminal group (models.PlatformResponse). */
export interface GroupedPlatform {
  code: number;
  bay: string;
  coordinates: Coordinates;
}

/** Terminal with its bays (models.BusTerminalWithPlatformsResponse). */
export interface TerminalWithPlatforms {
  uuid: string;
  external_terminal_id?: string | null;
  postal_code: string;
  name: string;
  platforms: GroupedPlatform[];
}

/** GET /api/admin/platforms (models.ListPlatformsResponse). */
export interface ListPlatformsResponse {
  platforms: TerminalWithPlatforms[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListPlatformsParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  bus_terminal_id?: string;
}

/** POST /api/admin/platforms */
export interface CreatePlatformRequest {
  bay: string;
  coordinates: Coordinates;
  bus_terminal_id: string;
}

/** PUT /api/admin/platforms/:code (optional fields, models.UpdatePlatformRequest). */
export interface UpdatePlatformRequest {
  bay?: string;
  coordinates?: Coordinates;
}
