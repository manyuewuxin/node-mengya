const ObjectId = require("mongodb").ObjectId;
const collection = require("../models/index");

class Admin {
    getAdmin(admin_id) {
        if (typeof admin_id == "string") {
            return collection.admin.findOne({ _id: new ObjectId(admin_id) });
        }
        return null;
    }

    async login({ name, password }) { //管理员为公共实验性账号
        if (typeof name == "string" && typeof password == "string") {
            const query_name = await collection.admin.findOne({ name: name });
            if (query_name) {
                const is_correct = await collection.admin.findOne({ password: password });
                if (is_correct) {
                    return query_name;
                } else {
                    return Promise.reject("密码错误");
                }
            } else {
                await this.query(name);
                const admins = await collection.admin.insertOne({
                    name: name,
                    password: password,
                    avatar: "/avatar/dafault.png"
                });
                return admins.ops[0];
            }
        }
        throw new Error("login");
    }
    async query(name) {
        //查询用户名
        if (typeof name == "string") {
            const user = await collection.admin.findOne({ name: name });
            if (user) {
                return Promise.reject("密码错误");
            } else {
                return true;
            }
        }
        throw new Error("query");
    }

    getWeek() {
        const date = new Date(); //本月的日期

        const ldate = new Date(); //上个月的日期，返回上个月最大日期是几号
        ldate.setMonth(ldate.getMonth());
        ldate.setDate(0);
        const ldt = ldate.getDate();

        const arr = [6, 5, 4, 3, 2, 1, 0].map((i) => {
            if (date.getDate() - i > 0) {
                return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() -
                    i}`;
            } else {
                const num = date.getDate() - i;
                return `${date.getFullYear()}-${date.getMonth()}-${ldt + num}`;
            }
        });
        arr.push(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() + 1}`);
        return arr;
    }

    async getChart() {
        const user = { date_arr: [], current_count: 0, all_count: 0 };
        const posts = { date_arr: [], current_count: 0, all_count: 0 };
        const week = this.getWeek();
        const length = week.length - 1;

        for (let n = 0; n < length; n++) {  //不要使用promise.all
            posts.date_arr[n] = await collection.posts
                .find({
                    $and: [
                        { date: { $gte: new Date(week[n]) } },
                        { date: { $lt: new Date(week[n + 1]) } }
                    ]
                })
                .count();
            user.date_arr[n] = await collection.user
                .find({
                    $and: [
                        { date: { $gte: new Date(week[n]) } },
                        { date: { $lt: new Date(week[n + 1]) } }
                    ]
                })
                .count();
        }
        posts.all_count = await collection.posts.find({}).count();
        user.all_count = await collection.user.find({}).count();
        return { user, posts };
    }

    async agreeArticle({ check_posts_id, state }) {  //审核通过
        if (typeof check_posts_id == "string" && typeof state == "number") {
            const { posts_id, ...article } = await collection.checkposts.findOne({
                _id: new ObjectId(check_posts_id)
            });

            if (posts_id === undefined) {  //如果不是更新就创建他
                const { ops } = await collection.posts.insertOne(
                    Object.assign({}, article, {
                        author_id: new ObjectId(article.author_id),
                        date: new Date(article.date),
                        state: 2,
                        like: [],
                        read_count: 0,
                        comment_count: 0
                    })
                );
                await collection.comment.insertOne({
                    posts_id: new ObjectId(ops[0]._id),
                    comment_count: 0,
                    comment: []
                });
                await collection.user.findOneAndUpdate(
                    { _id: new ObjectId(ops[0].author_id) },
                    { $inc: { create_p_count: +1 } }
                );
                await collection.dynamic.findOneAndUpdate(
                    { user_id: new ObjectId(ops[0].author_id) },
                    {
                        $push: {
                            dynamic: {
                                posts_id: new ObjectId(ops[0]._id),
                                dynamic_type: "create",
                                date: new Date(article.date)
                            }
                        },
                        $inc: { dynamic_count: +1 }
                    }
                );
                await collection.label.findOneAndUpdate({ type: article.type[0] },{ $inc: { article_count: +1 } });
            }
            else {
                await collection.posts.findOneAndUpdate(
                    { _id: new ObjectId(posts_id) },
                    { $set: Object.assign({}, article, { state: 2 }) }
                );
            }
            await collection.checkposts.findOneAndDelete({ _id: new ObjectId(check_posts_id) }); //删除检查文章
            return true;
        }
        throw new Error("agreeArticle");
    }

    async rejectArticle({ posts_id, state }) { //拒绝通过文章
        if (typeof posts_id == "string" && typeof state == "number") {
            if (state === 0) {
                await collection.checkposts.findOneAndUpdate(
                    { _id: new ObjectId(posts_id) },
                    { $set: { state: 1 } }
                );
            }
            else if (state === 2) {
                const article = await collection.posts.findOne({
                    _id: new ObjectId(posts_id)
                }); //获取
                await collection.posts.findOneAndUpdate(
                    { _id: new ObjectId(posts_id) },
                    { $set: { state: 1 } }
                );
                await collection.checkposts.insertOne(
                    Object.assign({}, article, { posts_id: article._id, state: 1 })
                ); //插入检查集合
            }
            return true;
        }
        throw new Error("rejectArticle");
    }

    async AdminRemoveArticle({ posts_id, state }) {  //管理员删除文章
        if (typeof posts_id == "string" && typeof state == "number") {
            if (state === 0 || state === 1) {
                await collection.checkposts.findOneAndDelete({
                    _id: new ObjectId(posts_id)
                });
            } 
            else if (state === 2) {
                const { value } = await collection.posts.findOneAndDelete({ _id: new ObjectId(posts_id) });
                await this.r_ArticleAssociatedDocument({
                    posts_id: posts_id,
                    author_id: value.author_id
                });
            }
            return true;
        }
        throw new Error("AdminRemoveArticle");
    }

    async r_ArticleAssociatedDocument({ posts_id, author_id }) {  //删除posts集合某个文档所有关联集合文档
        if (typeof posts_id == "string" && typeof author_id == "object") {
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
        throw new Error("r_ArticleAssociatedDocument");
    }

    getPostsCount(str) {
        if (str === "checkposts") {
            return collection.checkposts.find({}).count();
        } else if (str === "posts") {
            return collection.posts.find({}).count();
        }
        throw new Error("getPostsCount");
    }

    async getTableUser(skip) {
        if (typeof skip == "number") {
            const count = await collection.user.find({}).count();
            const user = await collection.user
                .find({})
                .sort({ date: -1 })
                .skip(skip)
                .limit(10)
                .project({ name: 1, date: 1, region: 1 })
                .toArray();
            return { user, count };
        }
        throw new Error("getTableUser");
    }

    async getTablePosts(skip) {
        if (typeof skip == "number") {
            const checkposts_count = await this.getPostsCount("checkposts");
            const posts_count = await this.getPostsCount("posts");
            const pa = await this.$checkpostsLookup({}, skip);
            const { pb, limit } = await this.addTable(pa.length);
            return {
                p: pa.concat(pb),
                count: checkposts_count + posts_count,
                limit: limit
            };
        }
        throw new Error("getTablePosts");
    }

    async addTable(length) {
        if (typeof length == "number" && length === 10) {
            return { pb: [], limit: 0 };
        } else if (typeof length == "number") {
            const limit = 10 - length;
            const pb = await this.$postsLookup({}, 0, limit);
            return { pb: pb, limit: limit };
        }
        throw new Error("addTable");
    }

    $checkpostsLookup(query, skip) {
        if (typeof query == "object" && typeof skip == "number") {
            return collection.checkposts
                .aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: "user",
                            let: { author_id: "$author_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$author_id"] } } },
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
                    { $sort: { date: -1 } },
                    { $skip: skip },
                    { $limit: 10 },
                    {
                        $project: {
                            author: 1,
                            title: 1,
                            html: 1,
                            image: 1,
                            state: 1,
                            date: 1
                        }
                    }
                ])
                .toArray();
        }

        throw new Error("$checkpostsLookup");
    }

    $postsLookup(query, skip, limit) {
        if (
            typeof query == "object" &&
            typeof skip == "number" &&
            typeof limit == "number"
        ) {
            return collection.posts
                .aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: "user",
                            let: { author_id: "$author_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$author_id"] } } },
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
                    { $sort: { date: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            author: 1,
                            title: 1,
                            html: 1,
                            image: 1,
                            state: 1,
                            date: 1
                        }
                    }
                ])
                .toArray();
        }
        throw new Error("$postsLookup");
    }

    async getArticle(posts_id, state) {
        if (typeof posts_id == "string" && typeof state == "number") {
            if (state === 2) {
                return this.$postsLookup({ _id: new ObjectId(posts_id) }, 0, 1);
            } else if (state === 0 || state === 1) {
                return this.$checkpostsLookup({ _id: new ObjectId(posts_id) }, 0);
            }
        }
        throw new Error("getArticle");
    }

    async getLabel({ type, skip }) {
        if (typeof type == "string" && typeof skip == "number") {
            var count = 0;
            const query = type === "all" ? {} : { type: type };
            const label = await collection.label
                .find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(16)
                .toArray();
            if (type === "all") count = await collection.label.find({}).count();
            return { label, count };
        }
        throw new Error("getLabelAll");
    }

    createLabel(options) {
        if (typeof options == "object") {
            options.followtype_count = 0;
            options.article_count = 0;
            options.date = new Date();
            return collection.label.insertOne(options);
        }
        throw new Error("createLabel");
    }

    updateLabel({ label_id, ...options }) {
        if (typeof options == "object" && typeof label_id == "string") {
            return collection.label.findOneAndUpdate(
                { _id: new ObjectId(label_id) },
                { $set: options }
            );
        }
        throw new Error("updateLabel");
    }

    async removeLabel({ label_id, skip }) {
        if (Array.isArray(label_id) && typeof skip == "number") {
            const label = label_id.map((_id) => {
                return new ObjectId(_id);
            });
            await collection.label.deleteMany({ _id: { $in: label } });
            return this.getLabel({ type: "all", skip: skip });
        }
        throw new Error("removeLabel");
    }
}
module.exports = new Admin();
