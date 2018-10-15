
module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "type",
                "image",
                "followtype_count",
                "article_count",
                "describe",
                "date"
            ],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                type: {
                    type: "string"
                },
                image: {
                    type: "string"
                },
                followtype_count: {
                    type: "number"
                },
                article_count: {
                    type: "number"
                },
                describe: {
                    type: "string"
                },
                date: {
                    bsonType: "date"
                }
            }
        }
    },
    indexes: [
        { key: { date: 1 }, name: "date_1" },
        { key: { type: 1 }, name: "type_1", unique: true }
    ]
};
