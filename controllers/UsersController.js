import sha1 from 'sha1';
import dbClient from '../utils/db';
const RedisClient = require('../utils/redis');
const { ObjectId } = require('mongodb');

class UsersController {
  static postNew(reqst, respo) {
    const { email } = reqst.body;
    const { password } = reqst.body;

    if (!email) {
      respo.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      respo.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    users.findOne({ email }, (err, user) => {
      if (user) {
        respo.status(400).json({ error: 'Already exist' });
      } else {
        const hashedPassword = sha1(password);
        users.insertOne(
          {
            email,
            password: hashedPassword,
          },
        ).then((result) => {
          respo.status(201).json({ id: result.insertedId, email });

        }).catch((error) => console.log(error));
      }
    });
  }

  static async getMe(req, res){
    try {
      const token  = req.headers['x-token']
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
        
      }else{
        const id = await RedisClient.get(`auth_${token}`)
  
        if (id) {
          const usersCollection = dbClient.db.collection('users')
          const user = await usersCollection.findOne({_id: ObjectId(id)})
          if (user) {
            res.status(200).json({ id: user._id, email: user.email });
          } else {
            res.status(401).json({ error: 'Unauthorized' });
          }
  
          
        }
        else{
          res.status(401).json({ error: 'Unauthorized' });


        }
  
  
      }
      
    } catch (error) {
      console.log(error)
      res.status(401).json({ error: 'Unauthorized' });
      
    }
   
  }
}

module.exports = UsersController;
