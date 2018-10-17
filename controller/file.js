const multer = require("multer");
const path = require("path");
const fs = require("fs");
const checkLogin = require("../middlewares/checkLogin");
const root_path = path.resolve(__dirname, "../public");

class File {
    constructor() {
        const storage = multer.diskStorage({
            destination(req, file, cb) {
                const fieldname = file.fieldname;
                if (/^(avatar|collect|editor|logo)$/.test(fieldname)) {
                    fs.stat(`${root_path}/${fieldname}`, (err, stats) => {
                        if (err) {
                            fs.mkdir(`${root_path}/${fieldname}`, (err2) => {
                                if (err2) {
                                    cb(new Error(`创建${filename}文件失败`));
                                } else {
                                    cb(null, path.resolve(root_path, fieldname));
                                }
                            });
                        } else {
                            cb(null, path.resolve(root_path, fieldname));
                        }
                    });
                } else {
                    cb(new Error("表单键名错误"));
                }
            },
            filename(req, file, cb) {
                const type = file.mimetype.split("/")[1]; //mime类型
                cb(null, `${Date.now()}.${type}`);
            }
        });

        this.upfile = multer({
            storage: storage,
            fileFilter(req, file, cb) {
                if (/^audio\/|^video\/|^image\//.test(file.mimetype)) {
                    if (/^image\//.test(file.mimetype) && file.size > 2000000) {
                        cb(new Error("图片文件过大"));
                    } else if (
                        /^audio\/|^video\//.test(file.mimetype) &&
                        file.size > 2000000
                    ) {
                        cb(new Error("音频文件过大"));
                    } else {
                        cb(null, true);
                    }
                } else {
                    cb(new Error("上传文件不是音频或图片格式的文件"));
                }
            }
        });
    }

    uploadFile(req, res) {
        const file = req.files[0];
        res.json({ url: `/${file.fieldname}/${file.filename}` });
    }

    removeFile(req, res, next) {
        if (req.body.url && req.body.folder) {
            const { url, folder } = req.body;
            const filename = url.split(`/${folder}/`)[1];

            if (/^dafault.png$/.test(filename) === false) {
                fs.stat(`${root_path}/${folder}`, (err1, stats) => { //判断目录是否存在
                    if (err1) {
                        fs.mkdir(`${root_path}/${folder}`, (err2) => {
                            if (err2) {
                                return next(err2);
                            } else {
                                res.status(200).end();
                            }
                        });
                    } else {
                        fs.unlink(
                            path.resolve(root_path, `${folder}/${filename}`),
                            (err3) => {
                                if (err3) {
                                    return next(err3);
                                } else {
                                    res.status(200).end();
                                }
                            }
                        );
                    }
                });
            } else {
                res.status(200).end();
            }
        } else {
            next("router参数错误");
        }
    }
}

const f = new File();

module.exports = {
    "post /file/upload": [checkLogin, f.upfile.any(), f.uploadFile],
    "post /file/remove": [checkLogin, f.removeFile]
};
