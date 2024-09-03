import { v4 as generateUUID } from 'uuid';
import { promises as fileSystem } from 'fs';
import { ObjectID as MongoID } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbService from '../utils/db';
import redisService from '../utils/redis';

const fileProcessingQueue = new Queue('fileQueue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  }
});

class FilesHandler {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisService.get(key);
    if (userId) {
      const usersCollection = dbService.db.collection('users');
      const idObject = new MongoID(userId);
      const user = await usersCollection.findOne({ _id: idObject });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(request, response) {
    const user = await FilesHandler.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { name, type, parentId, isPublic = false, data } = request.body;
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    const filesCollection = dbService.db.collection('files');
    if (parentId) {
      const idObject = new MongoID(parentId);
      const parentFile = await filesCollection.findOne({ _id: idObject, userId: user._id });
      if (!parentFile) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      filesCollection.insertOne({
        userId: user._id,
        name,
        type,
        parentId: parentId || 0,
        isPublic,
      })
      .then((result) => response.status(201).json({
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId || 0,
      }))
      .catch((error) => console.log(error));
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = `${folderPath}/${generateUUID()}`;
      const buffer = Buffer.from(data, 'base64');
      try {
        try {
          await fileSystem.mkdir(folderPath);
        } catch (error) {}
        await fileSystem.writeFile(fileName, buffer, 'utf-8');
      } catch (error) {
        console.log(error);
      }
      filesCollection.insertOne({
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId || 0,
        localPath: fileName,
      })
      .then((result) => {
        response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
        if (type === 'image') {
          fileProcessingQueue.add({
            userId: user._id,
            fileId: result.insertedId,
          });
        }
      })
      .catch((error) => console.log(error));
    }
    return null;
  }

  static async getShow(request, response) {
    const user = await FilesHandler.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = request.params.id;
    const filesCollection = dbService.db.collection('files');
    const idObject = new MongoID(fileId);
    const file = await filesCollection.findOne({ _id: idObject, userId: user._id });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesHandler.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { parentId, page } = request.query;
    const pageNum = page || 0;
    const filesCollection = dbService.db.collection('files');
    const query = parentId ? { userId: user._id, parentId: MongoID(parentId) } : { userId: user._id };
    filesCollection.aggregate([
      { $match: query },
      { $sort: { _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
          data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
        },
      },
    ])
    .toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tempFile = {
            ...file,
            id: file._id,
          };
          delete tempFile._id;
          delete tempFile.localPath;
          return tempFile;
        });
        return response.status(200).json(final);
      }
      console.log('Error occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const filesCollection = dbService.db.collection('files');
    const idObject = new MongoID(id);
    filesCollection.findOne({ _id: idObject }, async (err, file) => {
      if (!file) {
        return response.status(404).json({ error: 'Not found' });
      }
      if (file.isPublic) {
        if (file.type === 'folder') {
          return response.status(400).json({ error: "A folder doesn't have content" });
        }
        try {
          let fileName = file.localPath;
          const size = request.param('size');
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const fileData = await fileSystem.readFile(fileName);
          const contentType = mime.contentType(file.name);
          return response.header('Content-Type', contentType).status(200).send(fileData);
        } catch (error)
	       {
          console.log(error);
          return response.status(404).json({ error: 'Not found' });
        }
      } else {
        const user = await FilesHandler.getUser(request);
        if (!user) {
          return response.status(404).json({ error: 'Not found' });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === 'folder') {
            return response.status(400).json({ error: "A folder doesn't have content" });
          }
          try {
            let fileName = file.localPath;
            const size = request.param('size');
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return response.header('Content-Type', contentType).status(200).sendFile(fileName);
          } catch (error) {
            console.log(error);
            return response.status(404).json({ error: 'Not found' });
          }
        } else {
          console.log(`Wrong user: file.userId=${file.userId}; userId=${user._id}`);
          return response.status(404).json({ error: 'Not found' });
        }
      }
    });
  }

  static async putPublish(request, response) {
    const user = await FilesHandler.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbService.db.collection('files');
    const idObject = new MongoID(id);
    const updatedValue = { $set: { isPublic: true } };
    const options = { returnOriginal: false };
    filesCollection.findOneAndUpdate({ _id: idObject, userId: user._id }, updatedValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async putUnpublish(request, response) {
    const user = await FilesHandler.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbService.db.collection('files');
    const idObject = new MongoID(id);
    const updatedValue = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    filesCollection.findOneAndUpdate({ _id: idObject, userId: user._id }, updatedValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }
}

module.exports = FilesHandler;
