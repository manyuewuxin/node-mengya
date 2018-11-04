const xss = require("xss");
const assert = require("assert");
const axios = require("axios");
const checkLogin = require("../middlewares/checkLogin");
const service = require("../service/user");
const ROUTER_ERROR = process.env.NODE_ENV === "development" ? "router参数错误" : "服务器出了点问题";

class User {
    constructor() {
        this.register = this.register.bind(this);
        this.login = this.login.bind(this);
        this.getCollectPosts = this.getCollectPosts.bind(this);
        this.getMessage = this.getMessage.bind(this);
        this.getCollectList = this.getCollectList.bind(this);
        this.people = this.people.bind(this);
    }
    setvalue(value) {
        return value;
    }

    page(count, skip) {
        const c = Number(count);
        return (c - 1) * skip;
    }
    flatten(arr) {
        const list = arr.map((obj) => {
            obj.article.author = obj.author;
            return obj.article;
        });
        return list;
    }
    getAddress(req) {
        if (process.env.NODE_ENV === "production") {
            let ip =
                req.headers["x-forwarded-for"] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
            ip = req.ip.split("::ffff:")[1];
            return axios.get(`http://ip.taobao.com/service/getIpInfo.php?ip=${ip}`);
        } else {
            return {};
        }
    }
    async getUser(req, res, next) {
        try {
            const user = await service.getUser(req.session.user);
            await res.json({ user });
        } catch (err) {
            next(err);
        }
    }

    async register(req, res) {
        try {
            assert(!req.session.user, "该用户已登录");
            var { ...options } = req.body;

            assert(options.name, "用户名不能为空"); //检查空
            assert(options.email, "邮箱不能为空");
            assert(options.password, "密码不能为空");

            options.name = xss(options.name);
            options.email = xss(options.email);
            options.password = xss(options.password);
            await service.query({ key: "name", value: options.name });
            await service.query({ key: "email", value: options.email });
            const address = await this.getAddress(req);
            const user = await service.register(options, address);
            req.session.user = await this.setvalue(user.ops[0]._id);
            await res.status(200).end();
        } catch (err) {
            res.status(401).json({ err: err.toString() });
        }
    }

    async login(req, res) {  //登录
        assert(!req.session.user, "该用户已登录");
        try {
            const { ...options } = req.body;

            options.key = xss(options.key);
            options.value = xss(options.value);
            options.password = xss(options.password);

            assert(options.key, "用户名不能为空"); //空字符通过重写
            assert(options.value, "用户名不能为空");
            assert(options.password, "密码不能为空");
            const address = await axios.get(
                `http://ip.taobao.com/service/getIpInfo.php?ip=${req.ip}`
            );
            const user = await service.login(options, address);
            req.session.user = await this.setvalue(user._id);
            await res.status(200).end();
        } catch (err) {
            res.status(401).json({ err: err.toString() });
        }
    }

    signout(req, res) {   //退出登录
        req.session.user = null;
        req.session.page = null;
        req.session.limit = null;
        res.status(200).end();
    }

    async getAuthor(req, res, next) {  //获取作者信息
        if (req.query.user_id && req.query.is_home) {
            try {
                var author = await service.getAuthor(req.query);
                await res.json({ author });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getMessage(req, res, next) {  //单独获取消息
        if (!req.session.user) return res.json({ message: [], read_count: 0 });

        if (req.query.page) {
            try {
                const skip = this.page(req.query.page, 20);
                const user_id = req.session.user;
                const m = await service.getMessage({ user_id, skip });
                await res.json({ ...m });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async setMessage(req, res, next) {  //清空所有未读消息
        try {
            await service.setMessage(req.session.user);
            await res.status(200).end();
        } catch (err) {
            next(err);
        }
    }

    async getCollectList(req, res, next) {  //获取收藏夹列表
        if (req.query.page) {
            try {
                const user_id = req.session.user;
                const skip = this.page(req.query.page, 10);

                const collect = await service.getCollectList({ user_id, skip });

                await res.json({ collect });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async updateCollect(req, res, next) {  //收藏某个文章
        if (
            req.body.collect_id &&
            req.body.action &&
            req.body.posts_id &&
            req.body.author_id
        ) {
            try {
                const { ...options } = req.body;
                options.user_id = req.session.user;
                await service.updateCollect(options);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async createCollect(req, res, next) {  //创建收藏夹
        if (req.body.image && req.body.name) {
            try {
                var { ...options } = req.body;
                options.user_id = req.session.user;

                const { ops } = await service.createCollect(options);

                await res.json({ collect: ops[0] });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async removeCollect(req, res, next) {
        if (req.body.collect_id) {
            try {
                await service.removeCollect({
                    collect_id: req.body.collect_id,
                    user_id: req.session.user
                });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getCollectPosts(req, res, next) { //获取单个收藏夹所有收藏文章
        if (req.params.collect_id && req.query.page) {
            try {
                const skip = this.page(req.query.page, 10);
                const collect_id = req.params.collect_id;

                const {
                    collect,
                    user,
                    collect_count,
                    update_date
                } = await service.getCollectPosts({ skip, collect_id });

                const posts = await this.flatten(collect);

                await res.json({
                    posts,
                    user,
                    update_date,
                    count: Math.ceil(collect_count / 10)
                });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async setAccount(req, res, next) { //编辑个人资料
        if (req.query.method && Object.keys(req.body).length > 0) {
            try {
                const { ...data } = req.body;
                const method = req.query.method;
                const user_id = req.session.user;

                for (let key in data) {
                    data[key] = xss(data[key]);
                }

                await service.query({ key: "name", value: data.name });
                await service.setAccount(data, user_id, method);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async setFollowing(req, res, next) {  //关注某个用户
        if (
            req.body.author_id &&
            req.body.action &&
            req.session.user !== req.body.author_id
        ) {
            try {
                const { action, ...options } = req.body;
                options.user_id = req.session.user;
                await service.setFollowing(options, action);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async people(req, res, next) { //获取动态
        if (req.query.page && req.query.user_id) {
            try {
                const { page, user_id } = req.query;
                const skip = this.page(page, 10);
                const path = `people${req.params.path}`; //req.path.split('/')[1]

                if (typeof service[path] == "function") {
                    const { people, count } = await service[path]({ skip, user_id });
                    await res.json({ people, count: Math.ceil(count / 10) });
                } else {
                    await next("people映射路径不是函数");
                }
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async setFollowtype(req, res, next) {
        if (req.body.type && req.body.action) {
            try {
                const { type, action } = req.body;
                const user_id = req.session.user;
                await service.setFollowtype({ type, user_id, action });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }
}
const u = new User();

module.exports = {
    "get /user": [u.getUser],
    "get /user/author": [u.getAuthor],
    "get /user/message": [u.getMessage],
    "get /user/collect/:collect_id": [u.getCollectPosts],
    "get /user/collect": [checkLogin, u.getCollectList],
    "get /user/people/:path": [u.people],

    "post /user/signup": [u.register],
    "post /user/signin": [u.login],
    "post /user/message": [checkLogin, u.setMessage],
    "post /user/signout": [checkLogin, u.signout],
    "post /user/collect/update": [checkLogin, u.updateCollect],
    "post /user/collect/create": [checkLogin, u.createCollect],
    "post /user/collect/remove": [checkLogin, u.removeCollect],
    "post /user/account": [checkLogin, u.setAccount],
    "post /user/following": [checkLogin, u.setFollowing],
    "post /user/followtype": [checkLogin, u.setFollowtype]
};
