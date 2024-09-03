import redisService from '../utils/redis';
const cryptoModule = require('crypto');
const { v4: generateUUID } = require('uuid');
const databaseService = require('../utils/db');

class AuthController {
  static async getConnect(request, response) {
    const authorizationHeader = request.headers.authorization || '';
    const encodedCredentials = authorizationHeader.split(' ')[1] || '';
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('ascii');
    const [userEmail, userPassword] = decodedCredentials.split(':');

    if (!userEmail || !userPassword) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPassword = cryptoModule.createHash('sha1').update(userPassword).digest('hex');

    const usersCollection = databaseService.db.collection('users');
    const foundUser = await usersCollection.findOne({ email: userEmail, password: hashedPassword });

    if (!foundUser) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const authToken = generateUUID();
    const redisKey = `auth_${authToken}`;
    await redisService.set(redisKey, foundUser._id.toString(), 60 * 60 * 24);

    return response.status(200).json({ token: authToken });
  }

  static async getDisconnect(request, response) {
    const authToken = request.headers['x-token'];

    if (!authToken) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const redisKey = `auth_${authToken}`;
    const userId = await redisService.get(redisKey);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    await redisService.del(redisKey);

    return response.status(204).send();
  }
}

module.exports = AuthController;

