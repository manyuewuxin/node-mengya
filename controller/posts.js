const xss = require("xss");
const checkLogin = require("../middlewares/checkLogin");
const service = require("../service/posts");
const ROUTER_ERROR = process.env.NODE_ENV === "development" ? "router参数错误" : "服务器出了点问题";

class Posts {
    constructor() {
        this.getPostsList = this.getPostsList.bind(this);
        this.getComment = this.getComment.bind(this);
        this.createComment = this.createComment.bind(this);
        this.getUserPostsList = this.getUserPostsList.bind(this);
        this.getLabel = this.getLabel.bind(this);
        this.getHotPostsList = this.getHotPostsList.bind(this);
        this.getSearch = this.getSearch.bind(this);
        this.removeArticle = this.removeArticle.bind(this);
        this.getFollowPostsList = this.getFollowPostsList.bind(this);
    }
    setvalue(value) {
        return value;
    }

    page(count, skip) {
        const c = Number(count);
        return (c - 1) * skip;
    }
    flatten(foll) {
        var list = foll.map((obj) => {
            obj.posts.author = obj.author;
            return obj.posts;
        });
        return list;
    }

    async getUserPostsList(req, res, next) {
        if (req.session.user && req.query.page && req.query.type === "all") {
            try {
                const user_id = req.session.user;
                const skip = this.page(req.query.page, 10);
                const page = Number(req.query.page);

                const { followtype } = await service.getFollowTypePosts({ user_id });

                if (!req.session.page) {
                    const count = await service.getFollowTypePosts({
                        user_id: user_id,
                        get_count: true
                    });
                    req.session.page = await this.setvalue(Math.ceil(count / 10)); //如果没有关注任何标签，直接跳到第二个逻辑
                }

                if (req.session.page >= page) {
                    const { pa, pb, limit } = await service.getUserPostsList({
                        user_id,
                        skip,
                        followtype
                    });
                    const posts = await this.flatten(pa);
                    if (req.session.page === page)
                        req.session.limit = await this.setvalue(limit); //skip获取跳过
                    await res.json({ posts: posts.concat(pb) });
                } else {
                    const posts = await this.getNotFollowtypePosts(
                        followtype,
                        page - req.session.page,
                        req.session.limit
                    );
                    await res.json({ posts });
                }
            } catch (err) {
                next(err);
            }
        } else {
            next();
        }
    }

    getNotFollowtypePosts(followtype, page, limit) {
        const type = followtype.length > 0 ? { type: { $nin: followtype } } : {};
        const sort = { date: -1 };
        const skip = limit || this.page(page, 10);
        return service.$lookup({ type, sort, skip });
    }

    async getHotPostsList(req, res, next) { //热门
        if (req.query.type==="hot" && req.query.page) {
            try {
                const type = {};
                const sort = { read_count: -1, like: -1 };
                const skip = this.page(req.query.page, 10);
                const posts = await service.$lookup({ type, sort, skip });
                await res.json({ posts });
            } catch (err) {
                next(err);
            }
        } else {
            next();
        }
    }

    async getFollowPostsList(req, res, next){
        if(req.query.type === "follow" && req.query.page){
            try{
                const sort = { date: -1 };
                const skip = this.page(req.query.page, 10);
                const { following } = await service.getFollowTypePosts({ user_id : req.session.user });
                if(following.length>0){
                    const posts = await service.getFollowPostsList({ following, sort, skip });
                    await res.json({ posts });
                }
                else {
                    await res.json({ posts: [] });
                }
            }catch(err){
                next(err);
            }
        }
        else{
            next();
        }
    }

    async getSearch(req, res, next) {
        //搜索
        if (req.query.search && req.query.page) {
            try {
                const { search, page } = req.query;
                const type = { title: { $regex: search, $options: "i" } };
                const sort = { date: -1 };
                const skip = this.page(page, 10);
                const posts = await service.$lookup({ type, sort, skip });
                await res.json({ posts });
            } catch (err) {
                next(err);
            }
        } else {
            next();
        }
    }

    async getPostsList(req, res, next) {
        if (req.query.type && req.query.page) {
            try {
                const type = req.query.type === "all" ? {} : { type: req.query.type };
                const sort = { date: -1 };
                const skip = this.page(req.query.page, 10);
                const posts = await service.$lookup({ type, sort, skip });
                await res.json({ posts });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getArticle(req, res, next) { //获取单个文章
        try {
            const posts = await service.getArticle(req.params.posts_id);
            await res.json({ posts });
        } catch (err) {
            next(err);
        }
    }

    async getLabel(req, res, next) {
        if ((req.query.type && req.query.page) || (req.query.search && req.query.page)) {
            try {
                const key = req.query.type ? "type" : "search";
                const value = req.query.type || req.query.search;
                const skip = this.page(req.query.page, 16);
                const user_id = req.session.user; //是否需要checkLogin

                const label = await service.getLabel({
                    [key]: value,
                    skip: skip,
                    user_id: user_id
                });
                await res.json({ label });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getHotOrderList(req, res, next) {
        try {
            const order = await service.getHotOrderList();
            await res.json({ order });
        } catch (err) {
            next(err);
        }
    }

    async createArticle(req, res, next) {
        //创建和更新文章
        if (req.body.title && req.body.type && req.body.text && req.body.html) {
            try {
                const { ...article } = req.body;
                article.title = xss(article.title);
                article.html = xss(article.html);
                article.text = xss(article.text);
                article.author_id = req.session.user;
                article.type = article.type.map((elem) => xss(elem));
                await service.createArticle(article);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async removeArticle(req, res, next) {
        if (req.body.posts_id) {
            try {
                const { posts_id } = req.body;
                const author_id = req.session.user;
                const { people, count } = await service.removeArticle({
                    posts_id,
                    author_id
                });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async likeArticle(req, res, next) {
        if (
            req.body.posts_id &&
            req.body.action &&
            req.body.author_id !== req.session.user
        ) {
            try {
                const { ...options } = req.body;
                options.user_id = req.session.user;

                await service.likeArticle(options);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getComment(req, res, next) {
        if (req.query.posts_id && req.query.page && req.query.sort) {
            try {
                const { posts_id, page } = req.query;
                const skip = this.page(page, 7);
                const sort = Number(req.query.sort);
                const { comment, count } = await service.getComment({
                    posts_id,
                    skip,
                    sort
                });
                await res.json({ comment, count, page: Math.ceil(count / 7) });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async createComment(req, res, next) {
        if (
            req.body.posts_id &&
            req.body.author_id &&
            req.body.text &&
            req.body.user &&
            req.body.user[0] === req.session.user
        ) {
            try {
                const { ...options } = req.body;

                options.user_id = req.session.user;
                options.text = xss(req.body.text);

                const comment = await service.createComment(options);

                await res.json({ comment });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async removeComment(req, res, next) {
        if (
            req.body.comment_id &&
            req.body.author_id &&
            req.body.posts_id &&
            req.body.user &&
            req.body.user[0] === req.session.user
        ) {
            try {
                const { ...options } = req.body;

                options.user_id = req.session.user;

                await service.removeComment(options);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async goodComment(req, res, next) {
        if (req.body.comment_id && req.body.posts_id && req.body.action) {
            try {
                await service.goodComment({ user_id: req.session.user, ...req.body });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }
}
const p = new Posts();

module.exports = {
    "get /posts": [p.getUserPostsList, p.getHotPostsList, p.getFollowPostsList, p.getSearch, p.getPostsList],
    "get /posts/order": [p.getHotOrderList],
    "get /posts/p/:posts_id": [p.getArticle],
    "get /posts/label": [p.getLabel],
    "get /posts/comment": [p.getComment],

    "post /posts/create": [checkLogin, p.createArticle],
    "post /posts/remove": [checkLogin, p.removeArticle],
    "post /posts/like": [checkLogin, p.likeArticle],
    "post /posts/comment/create": [checkLogin, p.createComment],
    "post /posts/comment/remove": [checkLogin, p.removeComment],
    "post /posts/comment/good": [checkLogin, p.goodComment]
};
