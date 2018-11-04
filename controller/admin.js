const checkLoginAdmin = require("../middlewares/checkLoginAdmin");
const xss = require("xss");
const service = require("../service/admin");
const ROUTER_ERROR = process.env.NODE_ENV === "development" ? "router参数错误" : "服务器出了点问题";

class Admin {
    constructor() {
        this.login = this.login.bind(this);
        this.getChart = this.getChart.bind(this);
        this.getTableUser = this.getTableUser.bind(this);
        this.getTablePosts = this.getTablePosts.bind(this);
        this.getLabel = this.getLabel.bind(this);
        this.removeLabel = this.removeLabel.bind(this);
        this.agreeArticle = this.agreeArticle.bind(this);
        this.rejectArticle = this.rejectArticle.bind(this);
        this.AdminRemoveArticle = this.AdminRemoveArticle.bind(this);
    }

    setvalue(value) {
        return value;
    }

    page(count, skip = 10) {
        const c = Number(count);
        return (c - 1) * skip;
    }
    format(timestamp) {
        const dt = new Date(timestamp);

        const date = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;

        const h = dt.getHours();
        const m = dt.getMinutes() < 10 ? `0${dt.getMinutes()}` : dt.getMinutes();

        const time = `${h}:${m}`;

        return `${date} ${time}`;
    }
    addIndex(arr) {
        const list = arr.map((obj, index) => {
            obj.index = index + 1;
            obj.key = index;
            obj.date = this.format(obj.date);
            return obj;
        });
        return list;
    }

    async getAdmin(req, res, next) {
        try {
            const user = await service.getAdmin(req.session.admin);
            await res.json({ user });
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        if (req.body.name && req.body.password) {
            try {
                const name = xss(req.body.name);
                const password = xss(req.body.password);
                const admin = await service.login({ name, password });
                req.session.admin = await this.setvalue(admin._id);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    signout(req, res) {
        req.session.admin = null;
        req.session.admin_page = null;
        req.session.admin_limit = null;
        res.status(200).end();
    }

    async getChart(req, res, next) {
        try {
            const chart = await service.getChart();
            chart.user.current_count = await this.setvalue(
                chart.user.date_arr[chart.user.date_arr.length - 1]
            );
            chart.posts.current_count = await this.setvalue(
                chart.posts.date_arr[chart.posts.date_arr.length - 1]
            );
            await res.json({ chart });
        } catch (err) {
            next(err);
        }
    }

    async getTableUser(req, res, next) {
        if (req.query.page) {
            try {
                const skip = this.page(req.query.page, 10);
                const { user, count } = await service.getTableUser(skip);
                const table = await this.addIndex(user);
                await res.json({ table: table, count: Math.ceil(count / 10) });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getTablePosts(req, res, next) {
        if (req.query.page && req.query.state) {
            try {
                const skip = this.page(req.query.page, 10);
                const state = Number(req.query.state);
                if (state === 0 || state === 1) {
                    const p = await service.$checkpostsLookup({ state: state }, skip);
                    const count = await service.getPostsCount("checkposts");
                    const table = await this.addIndex(p);
                    await res.json({ table: table, count: Math.ceil(count / 10) });
                } else if (state === 2) {
                    const p = await service.$postsLookup({ state: state }, skip, 10);
                    const count = await service.getPostsCount("posts");
                    const table = await this.addIndex(p);
                    await res.json({ table: table, count: Math.ceil(count / 10) });
                }

                /*
                不在统一合并两个集合文档
                const page = Number(req.query.page);

                if(!req.session.admin_page){
                    const count = await service.getPostsCount("checkposts");
                    req.session.admin_page = await this.setvalue(Math.ceil( count / 10 ));
                }

                if(req.session.admin_page >= page){
                    const { p, count, limit } = await service.getTablePosts(skip);
                    const table = await this.addIndex(p);
                    if(req.session.admin_page === page) req.session.admin_limit = await this.setvalue(limit);
                    await res.json({ table: table, count: Math.ceil(count / 10) });
                }

                else{
                    if(req.session.admin_limit){ //跳过填补skip
                        skip = await this.setvalue(req.session.admin_limit);
                        req.session.admin_limit = await this.setvalue(null);
                    }
                    else {
                        skip = await this.page(page - req.session.admin_page, 10);
                    }
                    const p_count = await service.getPostsCount("posts");
                    const c_count = await service.getPostsCount("checkposts");     
                    const p = await service.$postsLookup({}, skip, 10);
                    const table = await this.addIndex(p);
                    await res.json({ table: table, count: Math.ceil((p_count + c_count) / 10) });                
                }*/
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getArticle(req, res, next) {
        if (req.query.state !== undefined) {
            try {
                const article = await service.getArticle(
                    req.params.posts_id,
                    Number(req.query.state)
                );
                await res.json({ article });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async agreeArticle(req, res, next) {
        if (req.body.posts_id && req.body.state !== undefined) {
            try {
                const { posts_id, state } = req.body;
                await service.agreeArticle({ check_posts_id: posts_id, state: state });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async rejectArticle(req, res, next) {
        if (req.body.posts_id && req.body.state !== undefined) {
            try {
                await service.rejectArticle(req.body);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async AdminRemoveArticle(req, res, next) {
        if (req.body.posts_id && req.body.state !== undefined) {
            try {
                await service.AdminRemoveArticle(req.body);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async getLabel(req, res, next) {
        if (req.query.page && req.query.type) {
            try {
                const skip = this.page(req.query.page, 16);
                const { label, count } = await service.getLabel({
                    type: req.query.type,
                    skip: skip
                });
                await res.json({ label, count: Math.ceil(count / 16) });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async createLabel(req, res, next) {
        if (req.body.image && req.body.type && req.body.describe) {
            try {
                const type = xss(req.body.type);
                const describe = xss(req.body.describe);
                const image = req.body.image;
                await service.createLabel({ type, describe, image });
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }

    async updateLabel(req, res, next) {
        if (req.body.label_id && req.body.image && req.body.type && req.body.describe) {
            try {
                await service.updateLabel(req.body);
                await res.status(200).end();
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }
    async removeLabel(req, res, next) {
        if (req.body.label_id && req.body.page) {
            try {
                const skip = this.page(req.body.page, 16);
                const { label, count } = await service.removeLabel({
                    label_id: req.body.label_id,
                    skip: skip
                });
                await res.json({ label: label, count: Math.ceil(count / 16) });
            } catch (err) {
                next(err);
            }
        } else {
            next(ROUTER_ERROR);
        }
    }
}

const a = new Admin();

module.exports = {
    "get /admin": [a.getAdmin],
    "get /admin/chart": [checkLoginAdmin, a.getChart],
    "get /admin/p/:posts_id": [checkLoginAdmin, a.getArticle],
    "get /admin/table/posts": [checkLoginAdmin, a.getTablePosts],
    "get /admin/table/user": [checkLoginAdmin, a.getTableUser],
    "get /admin/label": [checkLoginAdmin, a.getLabel],

    "post /admin/user/signin": [a.login],
    "post /admin/user/signout": [checkLoginAdmin, a.signout],
    "post /admin/posts/agree": [checkLoginAdmin, a.agreeArticle],
    "post /admin/posts/reject": [checkLoginAdmin, a.rejectArticle],
    "post /admin/posts/remove": [checkLoginAdmin, a.AdminRemoveArticle],
    "post /admin/label/create": [checkLoginAdmin, a.createLabel],
    "post /admin/label/update": [checkLoginAdmin, a.updateLabel],
    "post /admin/label/remove": [checkLoginAdmin, a.removeLabel]
};
