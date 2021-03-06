let mongoose = global.variables.mongoose,
    Schema = mongoose.Schema;

let Card = new Schema({
    _id: {
        type: Schema.Types.ObjectId,
        default: () => {
            return mongoose.Types.ObjectId();
        }
    },
    user: {
        type: Schema.Types.ObjectId,
        required: true
    },
    image: {
        type: Schema.Types.String,
        default: ""
    },
    type: {
        type: Schema.Types.String,
        required: true
    },
    start: {
        type: Schema.Types.Number,
        required: true
    },
    usedTotal: {
        type: Schema.Types.Number,
        default: 0
    },
    balance: {
        type: Schema.Types.Number
    },
    name: {
        type: Schema.Types.String,
        required: true
    },
    exp: {
        type: Schema.Types.String,
        required: true
    },
    number: {
        type: Schema.Types.String,
        required: true,
        unique: true
    },
    cvv: {
        type: Schema.Types.Number,
        required: true
    }
});

global.Card = mongoose.model("card", Card);