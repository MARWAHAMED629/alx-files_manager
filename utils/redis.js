import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Represents a Redis client.
 */
class RedisClient {
  /**
   * Creates a new RedisClient instance.
   */
  constructor() {
    this.redisClientInstance = createClient();
    this.isConnected = true;
    
    this.redisClientInstance.on('error', (error) => {
      console.error('Redis client failed to connect:', error.message || error.toString());
      this.isConnected = false;
    });

    this.redisClientInstance.on('connect', () => {
      this.isConnected = true;
    });
  }

  /**
   * Checks if this client's connection to the Redis server is active.
   * @returns {boolean}
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Retrieves the value of a given key.
   * @param {String} redisKey The key of the item to retrieve.
   * @returns {String | Object}
   */
  async get(redisKey) {
    const getAsync = promisify(this.redisClientInstance.GET).bind(this.redisClientInstance);
    return getAsync(redisKey);
  }

  /**
   * Stores a key and its value along with an expiration time.
   * @param {String} redisKey The key of the item to store.
   * @param {String | Number | Boolean} redisValue The item to store.
   * @param {Number} expiration The expiration time of the item in seconds.
   * @returns {Promise<void>}
   */
  async set(redisKey, redisValue, expiration) {
    const setexAsync = promisify(this.redisClientInstance.SETEX).bind(this.redisClientInstance);
    await setexAsync(redisKey, expiration, redisValue);
  }

  /**
   * Removes the value of a given key.
   * @param {String} redisKey The key of the item to remove.
   * @returns {Promise<void>}
   */
  async del(redisKey) {
    const delAsync = promisify(this.redisClientInstance.DEL).bind(this.redisClientInstance);
    await delAsync(redisKey);
  }
}

export const redisClient = new RedisClient();
export default redisClient;

