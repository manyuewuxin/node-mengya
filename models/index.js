const mongodb = require("mongodb"); 
const MongoClient = mongodb.MongoClient;

const user =  require("./user");
const collect = require("./collect");
const dynamic = require("./dynamic");
const posts = require("./posts");
const message = require("./message");
const label = require('./label');
const comment = require('./comment');
const checkposts = require('./checkposts');
const admin = require('./admin');

class Mongo {
    constructor() {
        MongoClient.connect('mongodb://localhost:27017',{useNewUrlParser:true}).then((connect)=>{
            this.connect = connect;
            return connect.db("mengya");
        }).then((db)=>{
            this.db = db;
            return db.collections();
        }).then((coll_arr)=>{
            return this.keys(coll_arr);
        }).then((name)=>{
            this.coll_name=name;
            return this.setCollection();
        }).then(()=>{
            console.log("已初始化数据库");
        }).catch((err)=>{
            console.log(err);
        });
        
    }

    async setCollection(){
        this.user = await this.getCollection('user',user);
        this.collect = await this.getCollection('collect',collect);
        this.dynamic = await this.getCollection('dynamic',dynamic);
        this.posts = await this.getCollection('posts',posts);
        this.message = await this.getCollection('message',message);
        this.label = await this.getCollection('label',label);
        this.comment = await this.getCollection('comment',comment);
        this.checkposts = await this.getCollection('checkposts',checkposts);
        this.admin = await this.getCollection('admin',admin);
        return true;
    }

    async getCollection(name,schema){
        const toString = Object.prototype.toString;
        if(toString.call(schema.models) === "[object Object]" && toString.call(schema.indexes) === "[object Array]"){
            if(this.coll_name.includes(name)){
                await this.db.command({
                    collMod: name,
                    validator: schema.models,
                    validationLevel: "strict",
                    validationAction: "error"
                });
                return this.db.collection(name);       
            }
            else{
                const coll = await this.db.createCollection(name,{
                    validator: schema.models,
                    validationLevel: "strict",
                    validationAction: "error"
                });
                await coll.createIndexes(schema.indexes); 
                return coll;                  
            }
        }
        else{
            return Promise.reject(`schema params error,collection:${name}`);
        }
    }

    keys(arr){
        if (Array.isArray(arr)) {
            const names = arr.map((c)=>{
                return c.s.name;
            });
            return names;
        }
        else {
            return Promise.reject('collections not array');
        }        
    }
    close() {
        if(this.connect){
            this.connect.close();
        }
    }
}

module.exports = new Mongo();