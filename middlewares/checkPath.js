const path = require("path");
module.exports = function(req, res) {
    if (req.xhr) return res.status(404).end();
    return res.sendFile(path.resolve(__dirname, "../public/index.html"));
};
