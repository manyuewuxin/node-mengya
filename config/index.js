module.exports = {
	port: 8000,
	url: "mongodb://localhost:27017/mengya",
	session: {
		name: 'mengya',
		secret: 'mengya',
		cookie: {
			httpOnly: true,
			secure: false,
			maxAge: 1000 * 60 * 60 * 24
		}
	}
};