module.exports = function(err, req, res, next) {
    if (err) {
        console.error(err);
        typeof err == "string" ? res.status(400).json({ err: err }) : res.status(400).json({ err: err.message || err.toString() });
    } else {
        next();
    }
};