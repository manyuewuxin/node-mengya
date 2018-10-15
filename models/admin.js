module.exports ={
    models: { 
        $jsonSchema: {
            bsonType: "object",
            required: ["name", "password", "avatar"],
            additionalProperties: false,
            properties: {
                _id: {
                    bsonType: "objectId"
                },
                name: {
                    type: "string",
                    pattern: "^[a-zA-Z0-9\u4e00-\u9fa5]{2,8}$"
                },
                password: {
                    type: "string",
                    pattern: "^[a-zA-Z0-9]{6,15}$"
                },
                avatar: {
                    type: "string"
                }
            }
        }
    },
    indexes:[]
};
