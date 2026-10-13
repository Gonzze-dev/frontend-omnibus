/** City as returned by the backend (models.City). */
export interface City {
  postal_code: string;
  name: string;
}

/** POST /api/admin/cities */
export interface CreateCityRequest {
  postal_code: string;
  name: string;
}

/** PUT /api/admin/cities/:postal_code (optional fields, models.UpdateCityRequest). */
export interface UpdateCityRequest {
  postal_code?: string;
  name?: string;
}

/** GET /api/admin/cities (models.ListCitiesResponse). */
export interface ListCitiesResponse {
  cities: City[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListCitiesParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
}
