
module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: ["dynamic_count", "dynamic"],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                user_id: {
                    bsonType: "objectId"
                },
                dynamic_count: {
                    type: "number"
                },
                dynamic: {
                    type: "array",
                    items: {
                        bsonType: "object",
                        required: ["posts_id", "dynamic_type", "date"],
                        properties: {
                            posts_id: {
                                bsonType: "objectId"
                            },
                            dynamic_type: {
                                enum: ["create", "like", "collect"]
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
    indexes: [{ key: { "dynamic.date": 1 }, name: "dynamic_date_1" }]
};
