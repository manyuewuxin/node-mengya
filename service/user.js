const ObjectId = require("mongodb").ObjectId;
const bcrypt = require("bcryptjs");
const collection = require("../models/index");

class User {
    constructor() {
        this.type = { add: "$push", remove: "$pull" };
        this.compute = { add: +1, remove: -1 };
    }

    getUser(user_id = null) {
        if (user_id) {
            return collection.user.findOne(
                { _id: new ObjectId(user_id) },
                { projection: { password: 0, salt: 0 } }
            );
        }
        return null;
    }

    async login(options) { //登录
        if (typeof options == "object") {
            let user = await collection.user.findOne({ [options.key]: options.value });
            if (user !== null) {
                let test = await bcrypt.compare(options.password, user.password);
                if (test) {
                    const { password, ...account } = user;
                    return account;
                } else {
                    return Promise.reject("密码错误");
                }
            } else {
                return Promise.reject("该用户不存在");
            }
        }
        throw new Error("login");
    }

    async register(options, address) { //注册
        if (typeof options == "object" && typeof address == "object") {
            options.avatar = "/avatar/dafault.png";
            options.date = new Date();
            options.followtype = []; //关注的标签
            options.followers = []; //其他用户关注我
            options.following = []; //我关注的用户
            options.followers_count = 0;
            options.following_count = 0;
            options.create_p_count = 0; //创建的文章次数
            options.like = 0;
            options.collect = 0;
            options.information = "这个人没有写介绍";
            options.carrer = ""; //职业
            options.company = ""; //公司
            options.userlike = ""; //个人主页
            options.region = address.code === 0 ? address.data.region : "其他地区";
            var salt = await bcrypt.genSalt(10); //加密强度
            options.password = await bcrypt.hash(options.password, salt); //获取盐加密返回哈希表
            var user = await collection.user.insertOne(options);
            await collection.dynamic.insertOne({
                user_id: new ObjectId(user.ops[0]._id),
                dynamic_count: 0,
                dynamic: []
            });
            await collection.message.insertOne({
                user_id: new ObjectId(user.ops[0]._id),
                read_count: 0,
                message: []
            });
            return user;
        }
        throw new Error("register");
    }

    async query(options) { //查询用户名或邮箱是否已注册
        if (typeof options == "object") {
            const user = await collection.user.findOne({ [options.key]: options.value });
            if (user) {
                if (options.key === "name") {
                    return Promise.reject("该用户名已注册");
                } else {
                    return Promise.reject("该邮箱已注册");
                }
            } else {
                return true;
            }
        }
        throw new Error("query");
    }

    async getAuthor(options) {
        if (typeof options == "object") {
            const bool = Boolean(options.is_home);
            var author = await collection.user.findOne(
                { _id: new ObjectId(options.user_id) },
                { projection: { followers: 0, following: 0, password: 0, salt: 0 } }
            );
            if (bool) {
                author.posts = await collection.posts
                    .find({ author_id: new ObjectId(options.user_id) })
                    .sort({ title: -1 })
                    .limit(3)
                    .project({ title: 1 })
                    .toArray();
            }
            return author;
        }
        throw new Error("getAuthor");
    }

    getCollectList(options) { //获取收藏夹列表，多文档
        if (typeof options == "object") {
            return collection.collect
                .find({ user_id: new ObjectId(options.user_id) })
                .sort({ date: -1 })
                .skip(options.skip)
                .limit(10)
                .toArray();
        }
        throw new Error("getCollectList");
    }

    async getCollectPosts(options) {  //获取某个收藏夹收藏的文章//使用$zip
        if (typeof options == "object") {
            const {
                update_date,
                user_id,
                collect_count
            } = await collection.collect.findOne(
                { _id: new ObjectId(options.collect_id) },
                { projection: { update_date: 1, user_id: 1, collect_count: 1 } }
            );

            const user = await collection.user.findOne(
                { _id: new ObjectId(user_id) },
                { projection: { name: 1, avatar: 1 } }
            );

            const collect = await collection.collect
                .aggregate([
                    { $match: { _id: new ObjectId(options.collect_id) } },
                    { $unwind: "$collect_article" },
                    {
                        $lookup: {
                            from: "posts",
                            let: { posts_id: "$collect_article" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$posts_id"] } } }
                            ],
                            as: "article"
                        }
                    },

                    { $unwind: "$article" },
                    {
                        $lookup: {
                            from: "user",
                            let: { user_id: "$article.author_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
                                {
                                    $project: {
                                        _id: 1,
                                        name: 1,
                                        avatar: 1,
                                        information: 1
                                    }
                                }
                            ],
                            as: "author"
                        }
                    },

                    { $sort: { collect_article: -1 } },
                    { $skip: options.skip },
                    { $limit: 10 },

                    { $project: { article: 1, author: 1 } }
                ])
                .toArray();
            return { collect, user, collect_count, update_date };
        }
        throw new Error("getCollectPosts");
    }

    async updateCollect(options) {  //更新收藏夹
        if (typeof options == "object") {
            const { action } = options;
            const dynamic = {
                add: {
                    posts_id: new ObjectId(options.posts_id),
                    dynamic_type: "collect",
                    date: new Date()
                },
                remove: {
                    posts_id: new ObjectId(options.posts_id),
                    dynamic_type: "collect"
                }
            };

            await collection.collect.findOneAndUpdate(
                { _id: new ObjectId(options.collect_id) },
                {
                    [this.type[action]]: {
                        collect_article: new ObjectId(options.posts_id)
                    },
                    $set: { update_date: new Date() },
                    $inc: { collect_count: this.compute[action] }
                }
            );

            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(options.author_id) },
                { $inc: { collect: this.compute[action] } }
            );

            await collection.dynamic.findOneAndUpdate(
                { user_id: new ObjectId(options.user_id) },
                {
                    [this.type[action]]: { dynamic: dynamic[action] },
                    $inc: { dynamic_count: this.compute[action] }
                }
            );

            return true;
        }
        throw new Error("updateCollect");
    }

    createCollect(options) { //创建收藏夹
        if (typeof options == "object") {
            options.user_id = new ObjectId(options.user_id);
            options.collect_count = 0;
            options.collect_article = [];
            options.update_date = new Date();
            options.date = new Date();
            return collection.collect.insertOne(options);
        }
        throw new Error("createCollect");
    }

    removeCollect(options) {
        if (typeof options == "object") {
            collection.collect.findOneAndDelete({
                _id: new ObjectId(options.collect_id),
                user_id: new ObjectId(options.user_id)
            });
            return true;
        }
        throw new Error("removeCollect");
    }

    async setAccount(options, user_id, method) {
        if (typeof options == "object" && user_id && method == "profile") {
            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(user_id) },
                { $set: options }
            );
            return true;
        } else if (typeof options == "object" && user_id && method == "password") {
            let user = await collection.user.findOne(
                { _id: new ObjectId(user_id) },
                { projection: { salt: 1 } }
            );
            let test = await bcrypt.compare(options.password, user.salt);
            if (test) {
                let salt = await bcrypt.genSalt(10); //加密强度
                options.salt = await bcrypt.hash(options.newpassword, salt); //获取盐加密返回哈希表

                await collection.user.findOneAndUpdate(
                    { _id: new ObjectId(user_id) },
                    { $set: { salt: options.salt, password: options.newpassword } }
                );

                return true;
            } else {
                return Promise.reject("原密码错误");
            }
        }
        throw new Error("setAccount");
    }

    async getMessage(options) { //获取消息
        if (typeof options == "object") {
            //const count=await collection.message.aggregate([{$match:{user_id:new ObjectId(options.user_id)}},{$project:{arr:{$filter:{input:'$message',as:'m',cond:{$eq:['$$m.read',false]}}}}}]).toArray();
            const { read_count } = await collection.message.findOne(
                { user_id: new ObjectId(options.user_id) },
                { projection: { read_count: 1 } }
            );
            const message = await collection.message
                .aggregate([
                    { $match: { user_id: new ObjectId(options.user_id) } },
                    { $unwind: "$message" },

                    {
                        $lookup: {
                            from: "posts",
                            let: { posts_id: "$message.posts_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$posts_id"] } } },
                                { $project: { title: 1, _id: 1 } }
                            ],
                            as: "posts"
                        }
                    },

                    {
                        $lookup: {
                            from: "user",
                            let: { user_id: "$message.send_user_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },

                                { $project: { name: 1, _id: 1 } }
                            ],
                            as: "author"
                        }
                    },

                    { $sort: { "message.date": -1 } },
                    { $skip: options.skip }, //过滤
                    { $limit: 20 },
                    {
                        $project: {
                            posts: 1,
                            author: 1,
                            "message.message_type": 1,
                            user_id: 1
                        }
                    }
                ])
                .toArray();
            return { message, read_count };
        }
        throw new Error("getMessage");
    }

    setMessage(user_id) { //更新消息
        if (user_id) {
            return collection.message.findOneAndUpdate(
                { user_id: new ObjectId(user_id) },
                { $set: { read_count: 0 } }
            );
            //collection.message.findOneAndUpdate({user_id:new ObjectId(user_id)},{$set:{"message.$[elem].read":true}},{arrayFilters:[{"elem.read":false}]});
        }
        throw new Error("setMessage");
    }

    async peopledynamic(options) {  //获取动态
        if (typeof options == "object") {
            const { dynamic_count } = await collection.dynamic.findOne(
                { user_id: new ObjectId(options.user_id) },
                { projection: { dynamic_count: 1 } }
            );
            const people = await collection.dynamic
                .aggregate([
                    { $match: { user_id: new ObjectId(options.user_id) } },
                    { $unwind: "$dynamic" },

                    {
                        $lookup: {
                            from: "posts",
                            let: { posts_id: "$dynamic.posts_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$posts_id"] } } },
                                { $project: { _id: 1, title: 1, image: 1 } }
                            ],
                            as: "posts"
                        }
                    },
                    { $sort: { "dynamic.date": -1 } },
                    { $skip: options.skip },
                    { $limit: 10 },

                    {
                        $project: {
                            posts: 1,
                            "dynamic.dynamic_type": 1,
                            "dynamic.date": 1
                        }
                    }
                ])
                .toArray();
            return { people, count: dynamic_count };
        }
        throw new Error("peopledynamic");
    }

    async peoplearticle(options) {
        if (typeof options == "object") {
            const count = await collection.user.findOne(
                { _id: new ObjectId(options.user_id) },
                { projection: { create_p_count: 1 } }
            );
            const people = await collection.posts
                .aggregate([
                    { $match: { author_id: new ObjectId(options.user_id) } },
                    {
                        $lookup: {
                            from: "user",
                            let: { author_id: "$author_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$author_id"] } } },
                                {
                                    $project: {
                                        _id: 1,
                                        avatar: 1,
                                        name: 1,
                                        information: 1
                                    }
                                }
                            ],
                            as: "author"
                        }
                    },
                    { $sort: { date: -1 } },
                    { $skip: options.skip },
                    { $limit: 10 }
                ])
                .toArray();

            return { people: people, count: count.create_p_count };
        }
        throw new Error("peoplearticle");
    }

    async peoplecollect(options) {
        const collect = await this.getCollectList(options);
        const count = await collection.collect
            .find({ user_id: new ObjectId(options.user_id) })
            .count();
        return { people: collect, count };
    }

    peoplefollowing(options) {
        if (typeof options == "object") {
            options.type = "following";
            return this.getFollow(options);
        }
        throw new Error("peoplefollowing");
    }

    peoplefollowers(options) {
        if (typeof options == "object") {
            options.type = "followers";
            return this.getFollow(options);
        }
        throw new Error("peoplefollowers");
    }

    async getFollow(options) {
        const type = "$" + options.type;
        const f_count = `${options.type}_count`;

        const count = await collection.user.findOne(
            { _id: new ObjectId(options.user_id) },
            { projection: { [f_count]: 1 } }
        );

        const people = await collection.user
            .aggregate([
                { $match: { _id: new ObjectId(options.user_id) } },
                { $unwind: type },

                {
                    $lookup: {
                        from: "user",
                        let: { user_id: type },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
                            {
                                $project: {
                                    name: 1,
                                    avatar: 1,
                                    create_p_count: 1,
                                    followers_count: 1,
                                    information: 1
                                }
                            }
                        ],
                        as: "author"
                    }
                },

                { $sort: { [options.type]: -1 } },
                { $skip: options.skip },
                { $limit: 10 },
                { $project: { author: 1 } }
            ])
            .toArray();
        return { people, count: count[f_count] };
    }

    async setFollowing(options, action) {
        if ((typeof options == "object" && action === "add") || action === "remove") {
            const message = {
                add: {
                    send_user_id: new ObjectId(options.user_id),
                    message_type: "follow",
                    posts_id: null,
                    date: new Date()
                },
                remove: {
                    send_user_id: new ObjectId(options.user_id),
                    message_type: "follow"
                }
            };

            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(options.user_id) },
                {
                    //添加关注的ID
                    [this.type[action]]: { following: new ObjectId(options.author_id) },
                    $inc: { following_count: this.compute[action] }
                }
            );
            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(options.author_id) },
                {
                    //被关注添加ID
                    [this.type[action]]: { followers: new ObjectId(options.user_id) },
                    $inc: { followers_count: this.compute[action] }
                }
            );
            await collection.message.findOneAndUpdate(
                { user_id: new ObjectId(options.author_id) },
                {
                    //被关注发送消息
                    [this.type[action]]: { message: message[action] },
                    $inc: { read_count: this.compute[action] }
                }
            );
            return true;
        }
        throw new Error("setFollowing");
    }

    async setFollowtype(options) {
        if (typeof options == "object") {
            const { action } = options;

            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(options.user_id) },
                {
                    [this.type[action]]: { followtype: options.type }
                }
            );

            await collection.label.findOneAndUpdate(
                { type: options.type },
                { $inc: { followtype_count: this.compute[action] } }
            );
            return true;
        }
        throw new Error("setFollowtype");
    }
}

module.exports = new User();
