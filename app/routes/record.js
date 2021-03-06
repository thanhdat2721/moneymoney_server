let router = global.variables.router,
    mongoose = global.variables.mongoose,
    Record = global.Record,
    Card = global.Card;

/**
 * @function create_record
 * @instance
 * @param {string} datetime Date and time [timestamp] (Required).
 * @param {string} mode [Balance|Income] (Required).
 * @param {string} category [Food|Education|Sport|...] (Required).
 * @param {string} card Card id (Required).
 * @param {string} value Money (Required).
 * @param {string} note Note (Option).
 * @param {string} picture Picture [Base64] (Option).
 * @example <caption>Requesting /v1/record/create with the following POST data.</caption>
 * {
 *  datetime: 1500879600,
 *  category: 'Food',
 *  card: 0c4f2df1-5229-406d-9548-337a2dcc6d15,
 *  value: 90000
 * }
 */
router.post("/record/create", passport.authenticate("jwt", { session: false, failureRedirect: "/unauthorized" }), (req, res) => {
    var user = req.body.id,
        datetime = req.body.datetime,
        mode = req.body.mode,
        category = req.body.category,
        card = req.body.card,
        value = req.body.value,
        note = req.body.note,
        picture = req.body.picture;

    if (
        global.isEmpty(user) || 
        global.isEmpty(mode) || 
        global.isEmpty(category) || 
        global.isEmpty(card) || 
        isNaN(parseInt(value))
    ) return global.errorHandler(res, 400, "Bad request.");

    if (
        mode.toLowerCase() != "expense" && 
        mode.toLowerCase() != "income"
    ) return global.errorHandler(res, 200, "Now, we just supported 'Expense' and 'Income'.");

    Card
    .findOne({
        _id: mongoose.Types.ObjectId(card)
    })
    .then(result => {
        if (!result) return global.errorHandler(res, 200, "This card does not exist.");

        new Record({
            user,
            datetime: new Date(parseInt(datetime)*1000),
            mode: mode.toLowerCase(),
            card,
            category,
            value,
            note: note || "",
            picture: picture || ""
        })
        .save();

        if (mode.toLowerCase() === "expense") {
            result.usedTotal = parseInt(result.usedTotal) - parseInt(value);    
        }else {
            result.usedTotal = parseInt(result.usedTotal) + parseInt(value);
        }

        result.balance += result.usedTotal;
        
        result.save();

        return global.successHandler(res, 200, "The record was created successfully.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function get_record_by_card_id
 * @instance
 * @param {string} id Id of card (Required).
 * @example <caption>Requesting /v1/records?id=0c4f2df1-5229-406d-9548-337a2dcc6d15 with the following GET data.</caption>
 */
router.get("/records", passport.authenticate("jwt", { session: false, failureRedirect: "/unauthorized" }), (req, res) => {
    var user = req.param("id");

    if (
        global.isEmpty(user)
    ) return global.errorHandler(res, 400, "Bad request.");

    Record
    .aggregate([{
        $match: { user: mongoose.Types.ObjectId(user) }
    }, {
        $project: {
            category: "$category",
            type: "$mode",
            value: "$value",
            month: { $month: "$datetime" },
            year: { $year: "$datetime" }
        }
    }, {
        $group: {
            _id: { category: "$category", type: "$type", month: "$month", year: "$year" },
            sum: { $sum: "$value" },
            month: { $first: "$month" },
            year: { $first: "$year" }
        }
    }])
    .then(result => {
        return global.successHandler(res, 200, result);
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function get_record_by_category
 * @instance
 * @param {string} id Id of card (Required).
 * @param {string} mode [Balance|Income] (Required).
 * @param {string} category [Food|Education|Sport|...] (Required).
 * @example <caption>Requesting /v1/records/Expense/Food?id=0c4f2df1-5229-406d-9548-337a2dcc6d15&category=Food with the following GET data.</caption>
 */
router.get("/records/:mode/:category", passport.authenticate("jwt", { session: false, failureRedirect: "/unauthorized" }), (req, res) => {
    var mode = req.params.mode;
        category = req.params.category,
        user = req.param("id");

    if (
        global.isEmpty(mode) || 
        global.isEmpty(category)
    ) return global.errorHandler(res, 400, "Bad request.");

    if (
        mode.toLowerCase() != "expense" && 
        mode.toLowerCase() != "income"
    ) return global.errorHandler(res, 200, "Now, we just supported 'Expense' and 'Income'.");
    
    Record
    .aggregate([{
        $match: {
            mode: mode.toLowerCase(),
            category,
            user: mongoose.Types.ObjectId(user)
        }
    }, {
        $project: {
            month: { $month: "$datetime" },
            year: { $year: "$datetime" },
            mode: "$mode",
            category: "$category",
            card: "$card",
            value: "$value",
            note: "$note",
            picture: "$picture",
            time: { $dateToString: { format: "%d/%m/%Y %H:%M:%S", date: "$datetime" } }
        }
    }])
    .then(result => {
        return global.successHandler(res, 200, result);
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function delete_record
 * @instance
 * @param {string} id Record's id (Required).
 * @example <caption>Requesting /v1/record/delete with the following DELETE data.</caption>
 * {
 *  id: 597776c62c41f00e56acdc7b
 * }
 */
router.delete("/record/delete", passport.authenticate("jwt", { session: false, failureRedirect: "/unauthorized" }), (req, res) => {
    var _id = req.body.id || req.param("id");

    if (
        global.isEmpty(_id)
    ) return global.errorHandler(res, 400, "Bad request.");
    
    Record
    .findOneAndRemove({ _id: mongoose.Types.ObjectId(_id) })
    .then(record => {
        Card
        .findOne({
            _id: mongoose.Types.ObjectId(record.card)
        })
        .then(card => {
            if (record.mode.toLowerCase() === "expense") {
                card.usedTotal = parseInt(card.usedTotal) + parseInt(record.value);
                card.balance += record.value;
            }else {
                card.usedTotal = parseInt(card.usedTotal) - parseInt(record.value);
                card.balance -= record.value;
            }

            card.save();
        });
        
        return global.successHandler(res, 200, "The record was deleted successfully.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

/**
 * @function edit_record
 * @instance
 * @param {string} id Id of record (Required).
 * @param {string} datetime Date and time [timestamp] (Required).
 * @param {string} category [Food|Education|Sport|...] (Required).
 * @param {string} card Card id (Required).
 * @param {string} value Money (Required).
 * @param {string} note Note (Option).
 * @param {string} picture Picture [Base64] (Option).
 * @example <caption>Requesting /v1/record/edit with the following PATCH data.</caption>
 * {
 *  id: '5978ae30a8782607e865ba62',
 *  datetime: 1500879600,
 *  category: 'Food',
 *  card: 0c4f2df1-5229-406d-9548-337a2dcc6d15,
 *  value: 90000
 * }
 */
router.patch("/record/edit", passport.authenticate("jwt", { session: false, failureRedirect: "/unauthorized" }), (req, res) => {
    var _id = req.body.id,
        datetime = req.body.datetime,
        category = req.body.category,
        card = req.body.card,
        value = req.body.value,
        note = req.body.note,
        picture = req.body.picture;

    if (
        global.isEmpty(_id) || 
        global.isEmpty(datetime) || 
        global.isEmpty(category) || 
        global.isEmpty(card) || 
        isNaN(parseInt(value))
    ) return global.errorHandler(res, 400, "Bad request.");

    Record
    .findOne({
        _id: mongoose.Types.ObjectId(_id)
    })
    .then(record => {
        if (!record) return global.errorHandler(res, 200, "This record does not exist.");

        if (record.card != card) {
            Card
            .findOne({ _id: mongoose.Types.ObjectId(record.card) })
            .then(card => {
                if (record.mode.toLowerCase() === "expense") {
                    card.usedTotal = parseInt(card.usedTotal) + parseInt(value);
                }else {
                    card.usedTotal = parseInt(card.usedTotal) - parseInt(value);
                }
                card.save();
            })

            Card
            .findOne({ _id: mongoose.Types.ObjectId(card) })
            .then(card => {
                if (record.mode.toLowerCase() === "expense") {
                    card.usedTotal = parseInt(card.usedTotal) - parseInt(value);
                }else {
                    card.usedTotal = parseInt(card.usedTotal) + parseInt(value);
                }
                card.save();
            })
        }else {
            Card
            .findOne({ _id: mongoose.Types.ObjectId(card) })
            .then(card => {
                if (record.mode.toLowerCase() === "expense") {
                    if (card.usedTotal === 0) {
                        card.usedTotal = parseInt(card.usedTotal) - parseInt(value);
                    }else {
                        console.log(card.usedTotal)
                        card.usedTotal = parseInt(card.usedTotal) + parseInt(record.value) - parseInt(value);
                        console.log(card.usedTotal)
                    }
                }else {
                    if (card.usedTotal === 0) {
                        card.usedTotal = parseInt(card.usedTotal) + parseInt(value);
                    }else {
                        card.usedTotal = parseInt(card.usedTotal) - parseInt(record.value) + parseInt(value);
                    }
                }
                card.save();
            })
        }
        

        record.datetime = new Date(parseInt(datetime)*1000),
        record.category = category,
        record.card = card,
        record.value = value,
        record.note = note || "",
        record.picture = picture || ""
        record.save();
        
        return global.successHandler(res, 200, "The record was updated successfully.");
    })
    .catch(error => {
        return global.errorHandler(res, 200, error);
    });
});

module.exports = router;
