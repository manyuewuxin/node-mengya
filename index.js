const express = require("express");
//const fs = require('fs');
const path = require("path");
const app = express();
const body = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const router = require("./router");
const checkPath = require("./middlewares/checkPath");
const checkError = require("./middlewares/checkError");
const config = require("./config");

app.use(express.static(path.resolve(__dirname, "./public")));

app.use(body.json()); 

app.use(
    session({
        name: config.session.name, // 设置 cookie 中保存 session id 的字段名称
        secret: config.session.secret, // 通过设置 secret 来计算 hash 值并放在 cookie 中，使产生的 signedCookie 防篡改
        resave: true, // 强制更新 session
        saveUninitialized: false, // 设置为 false，强制创建一个 session，即使用户未登录
        cookie: config.session.cookie,              // 将 session 存储到 mongodb
        store: new MongoStore({
            url: config.url
        })
    })
);

app.use(router());

app.use(checkError);

app.use(checkPath);



app.listen(config.port, function() {
    console.log("已连接服务器");
});
 
 //如果是直接访问服务器，IP则返回的是本身IP，为::1，//实验不声明8000端口
 /*

app.all('*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.Origin || req.headers.origin || "http://mengya.com");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Credentials", true); //可以带cookies
    res.header("X-Powered-By", '3.2.1')
    if (req.method == 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});
*/