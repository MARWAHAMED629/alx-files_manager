import hashPassword from 'sha1';
import databaseClient from '../utils/db';
const RedisService = require('../utils/redis');
const { ObjectId } = require('mongodb');

class UsersController {
  static async createUser(req, res) {
    const { email } = req.body;
    const { password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const usersCollection = databaseClient.db.collection('users');
    try {
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      const hashedPassword = hashPassword(password);
      const result = await usersCollection.insertOne({
        email,
        password: hashedPassword,
      });

      res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Token is required' });
      }

      const userId = await RedisService.get(`auth_${token}`);
      if (userId) {
        const usersCollection = databaseClient.db.collection('users');
        const user = await usersCollection.findOne({ _id: ObjectId(userId) });
        if (user) {
          return res.status(200).json({ id: user._id, email: user.email });
        } else {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      } else {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.log(error);
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = UsersController;

