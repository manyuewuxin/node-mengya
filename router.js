const express = require('express');
const router = express.Router();
const fs = require('fs');

const addRouters = (objRouter) => {
    Object.keys(objRouter).forEach((key) => {
        
        const [ method, path ] = key.split(' ');

        router[method](path, objRouter[key]);

    });
};

 const Scan = () => {
    const url = './controller';
    const dir = fs.readdirSync(url);

    dir.forEach((filename) => {
        const routerModel = require(`${url}/${filename}`);
        addRouters(routerModel);
    });
};

const setRouters = () => {
    Scan();
    return router;
};

module.exports = setRouters;

