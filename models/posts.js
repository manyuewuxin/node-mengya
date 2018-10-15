
module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "author_id",
                "title",
                "html",
                "text",
                "type",
                "image",
                "state",
                "date"
            ],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                author_id: {
                    bsonType: "objectId"
                },
                title: {
                    type: "string"
                },
                html: {
                    type: "string"
                },
                text: {
                    type: "string"
                },
                type: {
                    type: "array"
                },
                image: {
                    bsonType: ["string", "null"]
                },
                state: {
                    type: "number"
                },
                date: {
                    bsonType: "date"
                },
                like: {
                    type: "array",
                    items: {
                        bsonType: "objectId"
                    }
                },
                read_count: {
                    type: "number"
                },
                comment_count: {
                    type: "number"
                }
            }
        }
    },
    indexes: [
        { key: { date: 1 }, name: "date_1" },
        { key: { type: 1 }, name: "type_1" },
        { key: { read_count: 1, like: 1 }, name: "read_count_like_1" }
    ]
};
