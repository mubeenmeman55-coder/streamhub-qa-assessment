/** Thin client over Playwright's APIRequestContext - the API-side equivalent of a page object. */
class CatalogApi {
  constructor(request) {
    this.request = request;
  }

  get(path, params) {
    return this.request.get(path, { params });
  }

  /** Raw path + query string, for malformed/repeated parameters that `params` cannot express */
  getRaw(pathAndQuery) {
    return this.request.get(pathAndQuery);
  }

  listTitles(params) {
    return this.get('/api/titles', params);
  }

  getTitle(id) {
    return this.get(`/api/titles/${id}`);
  }

  genres() {
    return this.get('/api/genres');
  }

  emi(params) {
    return this.get('/api/emi', params);
  }
}

module.exports = { CatalogApi };
