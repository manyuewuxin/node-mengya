module.exports = function(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        return res.status(403).end();
    }
};
