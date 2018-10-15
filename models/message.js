module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: ["read_count", "message"],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                user_id: {
                    bsonType: "objectId"
                },
                read_count: {
                    type: "number"
                },
                message: {
                    type: "array",
                    items: {
                        bsonType: "object",
                        required: ["send_user_id", "posts_id", "message_type", "date"],
                        properties: {
                            send_user_id: {
                                bsonType: "objectId"
                            },
                            posts_id: {
                                bsonType: ["objectId", "null"]
                            },
                            message_type: {
                                enum: ["reply_posts", "reply_comment", "follow"]
                            },
                            date: {
                                bsonType: "date"
                            }
                        }
                    }
                }
            }
        }
    },
    indexes: [
        { 
            key: { "message.date": 1 }, 
            name: "message_date_1" 
        }
    ]
};
