/** Coordenadas del anden, tal como viajan en la columna jsonb coordinates. */
export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Plataforma devuelta por POST/PUT /api/admin/platforms (models.Platform). */
export interface Plataforma {
  code: number;
  anden: string;
  coordinates: Coordenadas;
  bus_terminal_id: string;
}

/** Plataforma dentro de un grupo de terminal (models.PlatformResponse). */
export interface PlataformaEnGrupo {
  code: number;
  anden: string;
  coordinates: Coordenadas;
}

/** Terminal con sus andenes (models.BusTerminalWithPlatformsResponse). */
export interface TerminalConPlataformas {
  uuid: string;
  external_terminal_id?: string | null;
  postal_code: string;
  name: string;
  platforms: PlataformaEnGrupo[];
}

/** GET /api/admin/platforms (models.ListPlatformsResponse). */
export interface ListPlataformasResponse {
  platforms: TerminalConPlataformas[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListPlataformasParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  bus_terminal_id?: string;
}

/** POST /api/admin/platforms */
export interface CreatePlataformaRequest {
  anden: string;
  coordinates: Coordenadas;
  bus_terminal_id: string;
}

/** PUT /api/admin/platforms/:code (campos opcionales, models.UpdatePlatformRequest). */
export interface UpdatePlataformaRequest {
  anden?: string;
  coordinates?: Coordenadas;
}
