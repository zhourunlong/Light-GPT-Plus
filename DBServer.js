const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ChatDatabase.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the ChatDatabase database.');
});

db.serialize(() => {
    // Create topics table
    db.run(`CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        encApiKey TEXT NOT NULL
    )`);

    // Create conversations table
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        topicId TEXT NOT NULL,
        createdAt INTEGER NOT NULL
    )`);
});





const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors(), express.json());

const DBPort = 3456;
app.listen(DBPort, () => {
    console.log(`Server running on port ${DBPort}`);
});


function getTopics(encApiKey, callback) {
    const sql = `SELECT * FROM topics WHERE encApiKey = ? ORDER BY createdAt DESC`;
    db.all(sql, [encApiKey], (err, rows) => {callback(err, rows);});
}

app.get('/topics/by-apikey/:encApiKey', (req, res) => {
    const { encApiKey } = req.params;
    console.log('Fetching topics with encApiKey:', encApiKey);
    getTopics(encApiKey, (err, topics) => {
        if (err) {
            console.error('Error fetching topics:', err);
            res.sendStatus(500);
        } else {
            const topicIds = topics.map(topic => topic.id.slice(0, 5));
            console.log(topicIds);

            res.json(topics);
        }
    });
});


function getTopicById(topicId, callback) {
    const sql = `SELECT * FROM topics WHERE id = ?`;
    db.get(sql, [topicId], (err, row) => {callback(err, row);});
}

app.get('/topics/by-id/:topicId', (req, res) => {
    const { topicId } = req.params;
    console.log('Fetching topic:', topicId.slice(0, 5));
    getTopicById(topicId, (err, topic) => {
        if (err) {
            console.error('Error fetching topic:', err);
            res.sendStatus(500);
        } else {
            if (topic) {
                res.json(topic);
            } else {
                res.sendStatus(404);
            }
        }
    });
});


function getConversationsByTopicId(topicId, callback) {
    const sql = `SELECT * FROM conversations WHERE topicId = ? ORDER BY createdAt ASC`;
    db.all(sql, [topicId], (err, rows) => {callback(err, rows);});
}

app.get('/topics/by-id/:topicId/conversations', (req, res) => {
    const { topicId } = req.params;
    console.log('Fetching conversations for topic:', topicId.slice(0, 5));
    getConversationsByTopicId(topicId, (err, conversations) => {
        if (err) {
            console.error('Error fetching conversations:', err);
            res.sendStatus(500);
        } else {
            res.json(conversations);
        }
    });
});


function addConversation(conversation, callback) {
    const { id, role, content, topicId, createdAt } = conversation;
    const sql = `INSERT INTO conversations (id, role, content, topicId, createdAt) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [id, role, content, topicId, createdAt], (err) => {callback(err);});
}

app.post('/conversations', (req, res) => {
    const conversation = req.body;
    console.log(`Adding conversation ${conversation.id.slice(0, 5)} to topic ${conversation.topicId.slice(0, 5)}`);
    addConversation(conversation, (err) => {
        if (err) {
            console.error('Error adding conversation:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(201);
        }
    });
});


function deleteConversationById(conversationId, callback) {
    db.serialize(() => {
        let sql = `DELETE FROM conversations WHERE id = ?`;
        db.run(sql, [conversationId], (err) => {callback(err);});
    });
}

app.delete('/conversations/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    console.log('Deleting conversation:', conversationId.slice(0, 5));
    deleteConversationById(conversationId, (err) => {
        if (err) {
            console.error('Error deleting conversation:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(204);
        }
    });
});


function addTopic(topic, callback) {
    const { id, name, createdAt, encApiKey } = topic;
    const sql = `INSERT INTO topics (id, name, createdAt, encApiKey) VALUES (?, ?, ?, ?)`;
    db.run(sql, [id, name, createdAt, encApiKey], (err) => {callback(err);});
}

app.post('/topics', (req, res) => {
    const topicData = req.body;
    console.log('Adding topic: ', topicData.id.slice(0, 5));
    addTopic(topicData, (err) => {
        if (err) {
            console.error('Error adding topic:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(201);
        }
    });
});


function deleteTopicById(topicId, callback) {
    db.serialize(() => {
        const convSql = `DELETE FROM conversations WHERE topicId = ?`;
        db.run(convSql, [topicId], (err) => {
            if (err) {
                callback(err);
                return;
            }

            const topSql = `DELETE FROM topics WHERE id = ?`;
            db.run(topSql, [topicId], function(err) {callback(err);});
        });
    });
}

app.delete('/topics/by-id/:topicId', (req, res) => {
    const { topicId } = req.params;
    console.log('Deleting topic:', topicId.slice(0, 5));
    deleteTopicById(topicId, (err) => {
        if (err) {
            console.error('Error deleting topic:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(204);
        }
    });
});


function updateTopicNameById(topicId, name, callback) {
    const sql = `UPDATE topics SET name = ? WHERE id = ?`;
    db.run(sql, [name, topicId], (err) => {callback(err);});
}

app.patch('/topics/by-id/:topicId', (req, res) => {
    const { topicId } = req.params;
    const { name } = req.body;
    console.log('Updating topic name:', topicId.slice(0, 5), name);
    updateTopicNameById(topicId, name, (err) => {
        if (err) {
            console.error('Error updating topic name:', err);
            res.sendStatus(500);
        } else {
            res.send('Topic name updated successfully');
        }
    });
});
