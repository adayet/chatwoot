/* global axios */
import { DataManager } from '../helper/CacheHelper/DataManager';
import ApiClient from './ApiClient';

// KLIMABAZAR F-idb: an open blocked by another tab never settles on its own
const DB_OPEN_TIMEOUT_MS = 3000;

class CacheEnabledApiClient extends ApiClient {
  constructor(resource, options = {}) {
    super(resource, options);
    this.accountDataManager = null;
  }

  // These clients are module level singletons, so they are constructed before the router
  // has settled on an account: a boot at /app redirects to /app/accounts/:id without
  // re-evaluating the bundle. Resolving the store once in the constructor therefore pointed
  // every account at a single `cw-store-` database, where a shared default cache key could
  // hand one account another's rows. The account has to come from the route at read time.
  get dataManager() {
    const accountId = this.accountIdFromRoute;

    if (this.accountDataManager?.accountId !== accountId) {
      this.accountDataManager = new DataManager(accountId);
    }

    return this.accountDataManager;
  }

  // eslint-disable-next-line class-methods-use-this
  get cacheModelName() {
    throw new Error('cacheModelName is not defined');
  }

  get(cache = false) {
    if (cache) {
      return this.getFromCache();
    }

    return this.getFromNetwork();
  }

  getFromNetwork() {
    return axios.get(this.url);
  }

  // eslint-disable-next-line class-methods-use-this
  extractDataFromResponse(response) {
    return response.data.payload;
  }

  // eslint-disable-next-line class-methods-use-this
  marshallData(dataToParse) {
    return { data: { payload: dataToParse } };
  }

  // KLIMABAZAR F-idb: a tab still running a build without the release handler in
  // DataManager can hold the database through a logout delete or an upgrade. Give up
  // on the cache after a while so the caller falls back to the network.
  initDbWithTimeout() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('IndexedDB open timed out')),
        DB_OPEN_TIMEOUT_MS
      );
    });

    return Promise.race([this.dataManager.initDb(), timeout]).finally(() =>
      clearTimeout(timer)
    );
  }

  async getFromCache() {
    try {
      // IDB is not supported in Firefox private mode: https://bugzilla.mozilla.org/show_bug.cgi?id=781982
      await this.initDbWithTimeout();
    } catch {
      return this.getFromNetwork();
    }

    const { data } = await axios.get(
      `/api/v1/accounts/${this.accountIdFromRoute}/cache_keys`
    );
    const cacheKeyFromApi = data.cache_keys[this.cacheModelName];
    const isCacheValid = await this.validateCacheKey(cacheKeyFromApi);

    let localData = [];
    if (isCacheValid) {
      localData = await this.dataManager.get({
        modelName: this.cacheModelName,
      });
    }

    if (localData.length === 0) {
      return this.refetchAndCommit(cacheKeyFromApi);
    }

    return this.marshallData(localData);
  }

  async refetchAndCommit(newKey = null) {
    const response = await this.getFromNetwork();

    try {
      await this.initDbWithTimeout();

      await this.dataManager.replace({
        modelName: this.cacheModelName,
        data: this.extractDataFromResponse(response),
      });

      await this.dataManager.setCacheKeys({
        [this.cacheModelName]: newKey,
      });
    } catch {
      // Ignore error
    }

    return response;
  }

  async validateCacheKey(cacheKeyFromApi) {
    if (!this.dataManager.db) {
      await this.initDbWithTimeout();
    }

    const cachekey = await this.dataManager.getCacheKey(this.cacheModelName);
    return cacheKeyFromApi === cachekey;
  }
}

export default CacheEnabledApiClient;
