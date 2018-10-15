module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: ["posts_id", "comment_count", "comment"],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                posts_id: {
                    bsonType: "objectId"
                },
                comment_count: {
                    type: "number"
                },
                comment: {
                    type: "array",
                    items: {
                        bsonType: "object",
                        required: ["comment_id", "text", "user", "date", "good"],
                        properties: {
                            comment_id: {
                                bsonType: "objectId"
                            },
                            text: {
                                type: "string",
                                maxLength: 310
                            },
                            user: {
                                type: "array",
                                items: {
                                    bsonType: "objectId"
                                }
                            },
                            date: {
                                bsonType: "date"
                            },
                            good: {
                                type: "array",
                                items: {
                                    bsonType: "objectId"
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    indexes: [{ key: { "comment.date": 1 }, name: "comment_date_1" }]
};
