const ObjectId = require("mongodb").ObjectId;
const collection = require("../models/index");

class Posts {
    constructor() {
        this.type = { add: "$push", remove: "$pull" };
        this.compute = { add: +1, remove: -1 };
    }
    async getLabel({ type, search, skip, user_id }) {
        if (typeof skip == "number") {
            if (typeof type == "string") {
                if (type === "subscribed" && typeof user_id == "string") {
                    const { followtype } = await collection.user.findOne(
                        { _id: new ObjectId(user_id) },
                        { projection: { followtype: 1 } }
                    );
                    return collection.label
                        .find({ type: { $in: followtype } })
                        .skip(skip)
                        .limit(16)
                        .toArray();
                } else {
                    const query = type === "all" ? {} : { type: type };
                    return collection.label
                        .find(query)
                        .skip(skip)
                        .limit(16)
                        .toArray();
                }
            } else if (typeof search == "string") {
                return collection.label
                    .find({ type: { $regex: search, $options: "i" } })
                    .skip(skip)
                    .limit(16)
                    .toArray();
            }
        }
        throw new Error("getLabel");
    }

    async getFollowTypePosts({ user_id, get_count }) {
        if (typeof user_id == "string") {
            const { followtype, following } = await collection.user.findOne(
                { _id: new ObjectId(user_id) },
                { projection: { followtype: 1, following: 1 } }
            );
            if (get_count) {
                return collection.posts
                    .find({ type: { $all: [{ $elemMatch: { $in: followtype } }] } })
                    .count();
            }
            return { followtype, following };
        }
        throw new Error("getfollowtype");
    }

    async getUserPostsList({ user_id, skip, followtype }) { //用户关注标签文章列表
        if (
            typeof user_id == "string" &&
            typeof skip == "number" &&
            Array.isArray(followtype)
        ) {
            const pa = await collection.user
                .aggregate([
                    { $match: { _id: new ObjectId(user_id) } },
                    {
                        $lookup: {
                            from: "posts",
                            let: { fo: "$followtype" },
                            pipeline: [
                                { $unwind: "$type" },
                                { $match: { $expr: { $in: ["$type", "$$fo"] } } },
                                { $sort: { date: -1 } },
                                { $skip: skip },
                                { $limit: 10 }
                            ],
                            as: "posts"
                        }
                    },

                    { $unwind: "$posts" },

                    {
                        $lookup: {
                            from: "user",
                            let: { user_id: "$posts.author_id" },
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

                    { $project: { posts: 1, author: 1 } }
                ])
                .toArray();
            const { pb, limit } = await this.addPosts(pa.length, followtype);
            return { pa: pa, pb: pb, limit: limit };
        }
        throw new Error("getUserPostsList");
    }

    async addPosts(length, followtype) {
        if (typeof length == "number" && Array.isArray(followtype)) {
            if (length === 10) {
                return { pb: [], limit: 0 };
            } else {
                const limit = 10 - length;
                const type = { type: { $nin: followtype } };
                const sort = { date: -1 };
                const skip = 0;
                const pb = await this.$lookup({ type, sort, skip, limit });
                return { pb, limit };
            }
        }
        throw new Error("addPosts");
    }

    $lookup({ type, sort, skip, limit }) {
        const limits = limit || 10;
        return collection.posts
            .aggregate([
                { $match: type },
                {
                    $lookup: {
                        from: "user",
                        let: { author_id: "$author_id" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$author_id"] } } },
                            { $project: { _id: 1, avatar: 1, name: 1, information: 1 } }
                        ],
                        as: "author"
                    }
                },
                { $sort: sort },
                { $skip: skip },
                { $limit: limits }
            ])
            .toArray();
    }

    async getFollowPostsList({ following, sort, skip }){
        if(
            Array.isArray(following) && 
            typeof sort == "object" && 
            typeof skip == "number"
        ) {
            const follow = following.map((user_id)=>new ObjectId(user_id));
            const type = { author_id: { $in: follow } };
            return this.$lookup({ type, sort, skip });
        }
        throw new Error("getFollowPostsList");
    }
    
    async getArticle(posts_id) {
        //获取单个文章
        if (typeof posts_id == "string") {
            const type = { _id: new ObjectId(posts_id) };
            const sort = { title: -1 };
            const skip = 0;
            await this.updateRead(posts_id);
            return this.$lookup({ type, sort, skip });
        }
        throw new Error("getArticle");
    }

    updateRead(posts_id) {
        if (typeof posts_id == "string") {
            return collection.posts.findOneAndUpdate(
                { _id: new ObjectId(posts_id) },
                { $inc: { read_count: +1 } }
            );
        }
        throw new Error("updateRead");
    }

    getHotOrderList() {
        return collection.posts
            .find({})
            .sort({ read_count: -1, like: -1 })
            .skip(0)
            .limit(7)
            .project({ title: 1 })
            .toArray();
    }

    async createArticle(options) {
        if (typeof options == "object") {
            const { ...article } = options;
            if (article._id) {
                article._id = new ObjectId(article._id);
                article.posts_id = new ObjectId(article._id);
                article.like = article.like.map((user_id) => new ObjectId(user_id));
            }
            article.author_id = new ObjectId(article.author_id);
            article.state = 0; //0待审核，1拒绝，2通过
            article.date = new Date();
            await collection.checkposts.insertOne(article);
            return true;
        }
        throw new Error("createArticle");
    }

    async removeArticle({ posts_id, author_id }) {
        if (typeof posts_id == "string" && typeof author_id == "string") {
            await collection.posts.findOneAndDelete({ _id: new ObjectId(posts_id) });
            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(author_id) },
                { $inc: { create_p_count: -1 } }
            );
            await collection.comment.findOneAndDelete({
                posts_id: new ObjectId(posts_id)
            });
            await collection.dynamic.findOneAndUpdate(
                { user_id: new ObjectId(author_id) },
                {
                    $pull: {
                        dynamic: {
                            posts_id: new ObjectId(posts_id),
                            dynamic_type: "create"
                        }
                    },
                    $inc: { dynamic_count: -1 }
                }
            );
            return true;
        }
        throw new Error("removeArticle");
    }

    async likeArticle({ posts_id, user_id, author_id, action }) {
        if (
            typeof posts_id == "string" &&
            typeof user_id == "string" &&
            typeof author_id == "string" &&
            typeof action == "string"
        ) {
            const dynamic = {
                add: {
                    posts_id: new ObjectId(posts_id),
                    dynamic_type: "like",
                    date: new Date()
                },
                remove: { posts_id: new ObjectId(posts_id), dynamic_type: "like" }
            };
            await collection.posts.findOneAndUpdate(
                { _id: new ObjectId(posts_id) },
                {
                    [this.type[action]]: { like: new ObjectId(user_id) }
                }
            );
            await collection.user.findOneAndUpdate(
                { _id: new ObjectId(author_id) },
                { $inc: { like: this.compute[action] } }
            );

            await collection.dynamic.findOneAndUpdate(
                { user_id: new ObjectId(user_id) },
                {
                    [this.type[action]]: { dynamic: dynamic[action] },
                    $inc: { dynamic_count: this.compute[action] }
                }
            );

            return true;
        }
        throw new Error("likeArticle");
    }

    async getComment({ posts_id, skip, sort }) { //获取评论
        if (
            typeof posts_id == "string" &&
            typeof skip == "number" &&
            typeof sort == "number"
        ) {
            const { comment_count } = await collection.comment.findOne(
                { posts_id: new ObjectId(posts_id) },
                { projection: { comment_count: 1 } }
            );
            const comment = await collection.comment
                .aggregate([
                    { $match: { posts_id: new ObjectId(posts_id) } },
                    { $unwind: "$comment" },
                    {
                        $lookup: {
                            from: "user",
                            let: { users: "$comment.user" },
                            pipeline: [
                                { $match: { $expr: { $in: ["$_id", "$$users"] } } },
                                { $project: { name: 1, avatar: 1, _id: 1 } }
                            ],
                            as: "author"
                        }
                    },
                    { $sort: { "comment.date": sort } },
                    { $skip: skip },
                    { $limit: 7 },
                    { $project: { comment: 1, author: 1 } }
                ])
                .toArray();

            return { comment, count: comment_count };
        }
        throw new Error("getComment");
    }

    async createComment(options) {
        if (typeof options == "object") {
            const { posts_id, author_id, user_id, text, user } = options;

            const data = {};
            data.comment_id = new ObjectId();
            data.text = text;
            data.good = [];
            data.user = user.map(user_id => new ObjectId(user_id));
            data.date = new Date();

            await collection.comment.findOneAndUpdate(
                { posts_id: new ObjectId(posts_id) },
                {
                    $push: { comment: data },
                    $inc: { comment_count: +1 }
                }
            );

            await collection.posts.findOneAndUpdate(
                { _id: new ObjectId(posts_id) },
                { $inc: { comment_count: +1 } }
            );

            if (user.length > 1) {   //是否是回复用户评论
                if(user_id !== user[1]){   //被回复用户不是自己回复自己则发送消息
                    await collection.message.findOneAndUpdate(
                        { user_id: new ObjectId(user[1]) },
                        {
                            $push: {
                                message: {
                                    send_user_id: new ObjectId(user_id),
                                    posts_id: new ObjectId(posts_id),
                                    message_type: "reply_comment",
                                    date: new Date()
                                }
                            },
                            $inc: { read_count: +1 }
                        }
                    );
                }
                if(author_id !== user[1]){ //被回复的用户如果不是文章作者，则发送消息
                    await collection.message.findOneAndUpdate(
                        { user_id: new ObjectId(author_id) },
                        {
                            $push: {
                                message: {
                                    send_user_id: new ObjectId(user_id),
                                    posts_id: new ObjectId(posts_id),
                                    message_type: "reply_posts",
                                    date: new Date()
                                }
                            },
                            $inc: { read_count: +1 }
                        }
                    );                    
                }
            }

            else if (user_id !== author_id) { //是回复作者？
                await collection.message.findOneAndUpdate(
                    { user_id: new ObjectId(author_id) },
                    {
                        $push: {
                            message: {
                                send_user_id: new ObjectId(user_id),
                                posts_id: new ObjectId(posts_id),
                                message_type: "reply_posts",
                                date: new Date()
                            }
                        },
                        $inc: { read_count: +1 }
                    }
                );
            }

            const { comment } = await this.getComment({
                posts_id: posts_id,
                skip: 0,
                sort: -1
            });
            return comment[0];
        }
        throw new Error("createComment");
    }

    async removeComment(options) {
        if (typeof options == "object") {
            await collection.comment.findOneAndUpdate(
                { posts_id: new ObjectId(options.posts_id) },
                {
                    $pull: { comment: { comment_id: new ObjectId(options.comment_id) } },
                    $inc: { comment_count: -1 }
                }
            );
            await collection.posts.findOneAndUpdate(
                { _id: new ObjectId(options.posts_id) },
                { $inc: { comment_count: -1 } }
            );

            if (options.user.length > 1) {
                if(options.user_id !== options.user[1]){
                    await collection.message.findOneAndUpdate(
                        { user_id: new ObjectId(options.user[1]) },
                        {
                            $pull: {
                                message: {
                                    send_user_id: new ObjectId(options.user_id),
                                    message_type: "reply_comment"
                                }
                            }
                        }
                    );
                }
                if(options.author_id !== options.user[1]){
                    await collection.message.findOneAndUpdate(
                        { user_id: new ObjectId(options.author_id) },
                        {
                            $pull: {
                                message: {
                                    send_user_id: new ObjectId(options.user_id),
                                    message_type: "reply_posts"
                                }
                            }
                        }
                    );                    
                }
            }

            else if (options.user_id !== options.author_id) {
                await collection.message.findOneAndUpdate(
                    { user_id: new ObjectId(options.author_id) },
                    {
                        $pull: {
                            message: {
                                send_user_id: new ObjectId(options.user_id),
                                message_type: "reply_posts"
                            }
                        },
                        $inc: { read_count: -1 }
                    }
                );
            }
            return true;
        }
        throw new Error("removeComment");
    }

    goodComment({ comment_id, posts_id, user_id, action }) {  //点赞评论
        if (
            typeof comment_id == "string" &&
            typeof posts_id == "string" &&
            typeof user_id == "string" &&
            typeof action == "string"
        ) {
            return collection.comment.findOneAndUpdate(
                { posts_id: new ObjectId(posts_id) },
                {
                    [this.type[action]]: { "comment.$[elem].good": new ObjectId(user_id) }
                },
                { arrayFilters: [{ "elem.comment_id": new ObjectId(comment_id) }] }
            );
        }
        throw new Error("goodComment");
    }
}
module.exports = new Posts();
