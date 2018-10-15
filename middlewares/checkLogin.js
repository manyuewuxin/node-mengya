module.exports = function(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        return res.status(403).end();
    }
};
