/** Ciudad tal como la devuelve el backend (models.City). */
export interface Ciudad {
  postal_code: string;
  name: string;
}

/** POST /api/admin/cities */
export interface CreateCiudadRequest {
  postal_code: string;
  name: string;
}

/** PUT /api/admin/cities/:postal_code (campos opcionales, models.UpdateCityRequest). */
export interface UpdateCiudadRequest {
  postal_code?: string;
  name?: string;
}

/** GET /api/admin/cities (models.ListCitiesResponse). */
export interface ListCiudadesResponse {
  cities: Ciudad[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListCiudadesParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
}
