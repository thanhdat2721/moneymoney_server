let router = global.variables.router,
    uuid = global.variables.uuid,
    User = global.User,
    passport = global.passport,
    jwt = global.variables.jwt,
    crypto = require("../crypto"),
    secret = global.variables.secret,
    cache = require("apicache").middleware,
    nodemailer = require("nodemailer"),
    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // secure:true for port 465, secure:false for port 587
        auth: {
            user: "huynhtran.dangkhoa@gmail.com",
            pass: "01229088405lqd"
        }
    });

router.all("/", cache("5 minutes"), (req, res) => {
    return global.renderHandler(res, 200, "index");
});

/**
 * @function sign_in
 * @instance
 * @param {string} email Email (Required).
 * @param {string} password Password (Required).
 * @example <caption>Requesting /sign_in with the following POST data.</caption>
 * {
 *  email: 'abc@gmail.com',
 *  password: '1'
 * }
 */
// router.post("/sign_in", passport.authenticate("local", { failureRedirect: "/fail" }), (req, res) => {
//     return res.redirect("/success");
// });

router.post("/sign_in", (req, res) => {
    var email = req.body.email,
        password = req.body.password;

    User
    .findOne({
        email
    })
    .then(user => {
        if (!user) return global.errorHandler(res, 404, "Email does not exist.");

        user.comparePassword(password, function(err, isMatch) {
            if (err) return global.errorHandler(res, 200, err);

            if (!isMatch) return global.errorHandler(res, 200, "Email or password is incorrect.");
            
            var data = {
                email,
                password
            }
            var payload = crypto.encrypt(JSON.stringify(data));
            var token = jwt.sign(payload, secret);
            return global.successHandler(res, 302, {
                id: user._id,
                token
            });
        });
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function register
 * @instance
 * @param {string} email Email (Required).
 * @param {string} password Password (Required).
 * @param {string} name User's name (Required).
 * @example <caption>Requesting /register with the following POST data.</caption>
 * {
 *  email: 'abc@gmail.com',
 *  password: '1',
 *  name: 'Abc'
 * }
 */
router.post("/register", (req, res) => {
    var email = req.body.email,
        password = req.body.password,
        name = req.body.name;

    if (
        global.isEmpty(email) || 
        global.isEmpty(password) || 
        global.isEmpty(name)
    ) return global.errorHandler(res, 400, "Bad request.");

    new User({
        email,
        password,
        name
    })
    .save((error, result) => {
        if (error && error.code === 11000) {
            return global.errorHandler(res, 302, "Email already exist.");
        }

        return global.successHandler(res, 200, "Register success.");
    });
});

/**
 * @function Require_send_mail_to_reset_password
 * @instance
 * @param {string} email Email (Required).
 * @example <caption>Requesting /forgot with the following POST data.</caption>
 * {
 *  email: 'abc@gmail.com'
 * }
 */
router.post("/forgot", (req, res) => {
    var email = req.body.email;

    if (
        global.isEmpty(email)
    ) return global.errorHandler(res, 400, "Bad request.");

    User
    .findOne({
        email
    })
    .then(user => {
        if (!user) return global.errorHandler(res, 404, "This email does not exist.");

        transporter.sendMail({
            from: "MoneyMoneyApp",
            to: email,
            subject: "Password problem",
            html: global.emailTemplate("http://" + req.headers.host + "/forgot/" + user.session)
        }, (error, info) => {
            if (error) return global.errorHandler(res, 200, "An error has occurred, please try again later.");
        });

        return global.successHandler(res, 200, "Send mail successfully, please check mailbox.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function Redirect_to_website_reset_password
 * @instance
 * @param {string} sesstion Session (Required).
 * @example <caption>Requesting /forgot/8391d3aa-adc4-4990-8cba-431f6b6e6879 with the following GET data.</caption>
 */
router.get("/forgot/:session", (req, res) => {
    var session = req.params.session;

    console.log(session)

    if (
        global.isEmpty(session)
    ) return global.errorHandler(res, 400, "Bad request.");

    User
    .findOne({
        session
    })
    .then(user => {
        if (!user) return global.renderHandler(res, 404, "404");

        return global.renderHandler(res, 200, "forgot", { error: "" });
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function Reset_password
 * @instance
 * @param {string} sesstion Session (Required).
 * @param {string} newPassword New password (Required).
 * @param {string} confirmPassword Confirm password (Required).
 * @example <caption>Requesting /forgot/8391d3aa-adc4-4990-8cba-431f6b6e6879 with the following GET data.</caption>
 * {
 *  newPassword: '2',
 *  confirmPassword: '2'
 * }
 */
router.post("/reset/:session", (req, res) => {
    var session = req.params.session,
        newPassword = req.body.newPassword,
        confirmPassword = req.body.confirmPassword;

    if (
        global.isEmpty(session) || 
        global.isEmpty(newPassword) || 
        global.isEmpty(confirmPassword)
    ) return global.errorHandler(res, 400, "Bad request.");

    if (confirmPassword !== newPassword) return global.renderHandler(res, 200, "forgot", { error: "Password is not matching." });

    User
    .findOne({
        session
    })
    .then(user => {
        if (!user) return global.errorHandler(res, 404, "This email does not exist.");

        user.session = uuid.v4();
        user.password = newPassword;
        user.save();

        return global.successHandler(res, 200, "Change password successfully.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, "Change password failed.")
    });
});

/**
 * @function get_info
 * @instance
 * @param {string} id Id of user (Required).
 * @example <caption>Requesting /info?id=599717c3f4c70605197d9ed8 with the following GET data.</caption>
 */
router.get("/info", passport.authenticate("jwt", { session: false }), (req, res) => {
    var _id = req.param("id");

    if (
        !req.user
    ) return res.redirect("/");

    if (
        global.isEmpty(_id)
    ) return global.errorHandler(res, 400, "Bad request.");

    User
    .findOne({
        _id
    }, ["email", "name", "cards"])
    .then(user => {
        if (!user) return global.errorHandler(res, 404, "This email does not exist.");

        return global.successHandler(res, 201, user);
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function edit_info
 * @instance
 * @param {string} name Name of user (Required).
 * @param {string} id Id of user (Required).
 * @example <caption>Requesting /info with the following PATCH data.</caption>
 * {
 *  title: "",
 *  content: "",
 *  id: "59789c0db2638003d2712f95"
 * }
 */
router.patch("/info", passport.authenticate("jwt", { session: false }), (req, res) => {
    var _id = req.body.id,
        name = req.body.name;

    if (
        !req.user
    ) return res.redirect("/");

    if (
        global.isEmpty(_id) || 
        global.isEmpty(name)
    ) return global.errorHandler(res, 400, "Bad request.");

    User
    .findOneAndUpdate({
        _id
    }, {
        $set: {
            name
        }
    })
    .then(user => {
        if (!user) return global.errorHandler(res, 404, "This email does not exist.");

        return global.successHandler(res, 200, "Your info was updated successfully.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

module.exports = router;