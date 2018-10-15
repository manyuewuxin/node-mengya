module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "user_id",
                "name",
                "image",
                "date",
                "update_date",
                "collect_count",
                "collect_article"
            ],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                user_id: {
                    bsonType: "objectId"
                },
                name: {
                    type: "string"
                },
                image: {
                    type: "string"
                },
                date: {
                    bsonType: "date"
                },
                update_date: {
                    bsonType: "date"
                },
                collect_count: {
                    type: "number"
                },
                collect_article: {
                    type: "array",
                    items: {
                        bsonType: "objectId"
                    }
                }
            }
        }
    },
    indexes: []
};
