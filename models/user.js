module.exports = {
    models: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "name",
                "email",
                "password",
                "avatar",
                "date",
                "followtype",
                "followers",
                "following",
                "followers_count",
                "following_count",
                "create_p_count",
                "like",
                "collect",
                "information",
                "carrer",
                "company",
                "userlike",
                "region"
            ],
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                name: {
                    type: "string",
                    pattern: "^[a-zA-Z0-9\u4e00-\u9fa5]{2,8}$"
                },
                email: {
                    type: "string",
                    pattern:
                        "^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$"
                },
                salt: {
                    type: "string"
                },
                password: {
                    type: "string"
                },
                avatar: {
                    type: "string"
                },
                date: {
                    bsonType: "date"
                },
                followtype: {
                    type: "array",
                    items: {
                        type: "string"
                    }
                },
                followers: {
                    type: "array",
                    items: {
                        bsonType: "objectId"
                    }
                },
                following: {
                    type: "array",
                    items: {
                        bsonType: "objectId"
                    }
                },
                followers_count: {
                    type: "number"
                },
                following_count: {
                    type: "number"
                },
                create_p_count: {
                    type: "number"
                },
                like: {
                    type: "number"
                },
                collect: {
                    type: "number"
                },
                information: {
                    type: "string",
                    maxLength: 100
                },
                carrer: {
                    type: "string",
                    maxLength: 100
                },
                company: {
                    type: "string",
                    maxLength: 100
                },
                userlike: {
                    type: "string",
                    maxLength: 100
                },
                region: {
                    type: "string"
                }
            },
            additionalProperties: false
        }
    },
    indexes: [
        { key: { name: 1 }, name: "name_1", unique: true },
        { key: { email: 1 }, name: "email_1", unique: true }
    ]
};
