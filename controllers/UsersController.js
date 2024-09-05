import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import RedisClient from '../utils/redis';

class UsersController {
  static async postNew(reqst, respo) {
    const { email, password } = reqst.body;

    if (!email) {
      return respo.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return respo.status(400).json({ error: 'Missing password' });
    }

    const users = dbClient.db.collection('users');
    const user = await users.findOne({ email });

    if (user) {
      return respo.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);
    try {
      const result = await users.insertOne({
        email,
        password: hashedPassword,
      });
      return respo.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error(error);
      return respo.status(500).json({ error: 'Error inserting user' });
    }
  }

  static async getMe(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const id = await RedisClient.get(`auth_${token}`);

      if (!id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const usersCollection = dbClient.db.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(id) });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default UsersController;
